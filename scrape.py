"""
scrape.py — Récupère les stats AFDER via Apify et les ajoute à history.json
Tourne chaque lundi via GitHub Actions.
"""

import os, json, time, requests
from datetime import datetime, timezone

TOKEN = os.environ.get('APIFY_TOKEN', '')
BASE  = 'https://api.apify.com/v2'
TODAY = datetime.now(timezone.utc).strftime('%Y-%m-%d')

HANDLES = {
    'tiktok':      'https://www.tiktok.com/@afder.recovery',
    'instagram':   'afder.recovery',
    'facebook_fr': 'https://www.facebook.com/afder.recovery',
    'facebook_es': 'https://www.facebook.com/OldTimersRecovery/',
}

ACTORS = {
    'tiktok':    'clockworks~tiktok-scraper',
    'instagram': 'apify~instagram-scraper',
    'facebook':  'apify~facebook-pages-scraper',
}

LABELS = {
    'tiktok':      'TikTok',
    'instagram':   'Instagram',
    'facebook_fr': 'Facebook France',
    'facebook_es': 'Facebook Espagne',
}

# ── Apify runner ──────────────────────────────────────────────
def run_actor(actor_id, input_data, timeout=120):
    url = f"{BASE}/acts/{actor_id}/run-sync-get-dataset-items"
    params = {'token': TOKEN, 'timeout': timeout, 'memory': 256}
    try:
        r = requests.post(url, params=params, json=input_data, timeout=timeout + 10)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"  ✗ Erreur Apify {actor_id}: {e}")
        return None

# ── Scrapers ──────────────────────────────────────────────────
def scrape_tiktok():
    print("→ TikTok…")
    items = run_actor(ACTORS['tiktok'], {
        'profiles': [HANDLES['tiktok']],
        'resultsType': 'details',
        'maxProfilesPerQuery': 1,
    })
    if not items:
        return None
    p = items[0]
    meta = p.get('authorMeta', {})
    return {
        'platform':    'tiktok',
        'label':       LABELS['tiktok'],
        'date':        TODAY,
        'followers':   meta.get('fans', 0),
        'likes':       meta.get('heart', 0),
        'videos':      meta.get('video', 0),
        'views':       p.get('playCount', 0),
        'comments':    p.get('commentCount', 0),
        'shares':      p.get('shareCount', 0),
        'engagement':  round((p.get('diggCount', 0) + p.get('commentCount', 0) + p.get('shareCount', 0)) / max(p.get('playCount', 1), 1) * 100, 2),
    }

def scrape_instagram():
    print("→ Instagram…")
    items = run_actor(ACTORS['instagram'], {
        'usernames': [HANDLES['instagram']],
        'resultsType': 'details',
        'resultsLimit': 12,
    })
    if not items:
        return None
    p = items[0]
    posts = [i for i in items if i.get('likesCount') is not None]
    avg_likes    = sum(i.get('likesCount', 0) for i in posts) / max(len(posts), 1)
    avg_comments = sum(i.get('commentsCount', 0) for i in posts) / max(len(posts), 1)
    followers    = p.get('followersCount') or p.get('followedByCount') or 0
    engagement   = round((avg_likes + avg_comments) / max(followers, 1) * 100, 2) if followers else 0
    return {
        'platform':    'instagram',
        'label':       LABELS['instagram'],
        'date':        TODAY,
        'followers':   followers,
        'posts':       p.get('postsCount') or p.get('mediaCount') or 0,
        'likes':       round(avg_likes * (p.get('postsCount') or 1)),
        'comments':    round(avg_comments * (p.get('postsCount') or 1)),
        'engagement':  engagement,
    }

def scrape_facebook_page(key, url):
    print(f"→ {LABELS[key]}…")
    items = run_actor(ACTORS['facebook'], {
        'startUrls': [{'url': url}],
        'maxPosts': 10,
    })
    if not items:
        return None

    # Trouver la page principale
    page = next((i for i in items if i.get('likes') or i.get('followers') or i.get('title')), items[0])
    posts = [i for i in items if i.get('message') or i.get('text')]

    followers  = page.get('likes') or page.get('followers') or 0
    total_likes    = sum(i.get('likes', 0) for i in posts)
    total_comments = sum(i.get('comments', 0) for i in posts)
    total_shares   = sum(i.get('shares', 0) for i in posts)
    engagement = round((total_likes + total_comments + total_shares) / max(len(posts), 1) / max(followers, 1) * 100, 2) if followers else 0

    return {
        'platform':    key,
        'label':       LABELS[key],
        'date':        TODAY,
        'followers':   followers,
        'posts':       len(posts),
        'likes':       total_likes,
        'comments':    total_comments,
        'shares':      total_shares,
        'engagement':  engagement,
        'name':        page.get('title') or page.get('name') or LABELS[key],
    }

# ── Main ──────────────────────────────────────────────────────
def main():
    if not TOKEN:
        print("✗ APIFY_TOKEN manquant — vérifiez vos GitHub Secrets")
        exit(1)

    print(f"\n📊 Scraping AFDER — {TODAY}\n")

    results = []

    # TikTok
    r = scrape_tiktok()
    if r: results.append(r); print(f"  ✓ TikTok — {r['followers']:,} abonnés")

    time.sleep(2)

    # Instagram
    r = scrape_instagram()
    if r: results.append(r); print(f"  ✓ Instagram — {r['followers']:,} abonnés")

    time.sleep(2)

    # Facebook France
    r = scrape_facebook_page('facebook_fr', HANDLES['facebook_fr'])
    if r: results.append(r); print(f"  ✓ Facebook FR — {r['followers']:,} abonnés")

    time.sleep(2)

    # Facebook Espagne
    r = scrape_facebook_page('facebook_es', HANDLES['facebook_es'])
    if r: results.append(r); print(f"  ✓ Facebook ES — {r['followers']:,} abonnés")

    if not results:
        print("\n✗ Aucun résultat — history.json non modifié")
        exit(1)

    # ── Charger l'historique existant ─────────────────────────
    history_file = 'history.json'
    try:
        with open(history_file, 'r', encoding='utf-8') as f:
            history = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        history = []

    # Supprimer les entrées du même jour (évite doublons si relance)
    history = [e for e in history if e.get('date') != TODAY]

    # Ajouter les nouvelles entrées
    history.extend(results)

    # Garder les 104 dernières semaines (2 ans)
    history = sorted(history, key=lambda x: (x.get('date',''), x.get('platform','')))
    history = history[-104*4:]  # max 4 plateformes × 104 semaines

    # ── Sauvegarder ───────────────────────────────────────────
    with open(history_file, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

    print(f"\n✅ history.json mis à jour — {len(results)} plateformes, {len(history)} entrées au total\n")

if __name__ == '__main__':
    main()
