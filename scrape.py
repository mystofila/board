"""
scrape.py — Récupère les stats AFDER
- TikTok       : Apify
- Instagram    : API Graph officielle
- Facebook FR  : API Graph officielle
- Facebook ES  : Apify
"""

import os, json, time, requests
from datetime import datetime, timezone

TODAY = datetime.now(timezone.utc).strftime('%Y-%m-%d')

# ── Tokens ────────────────────────────────────────────────────
APIFY_TOKEN      = os.environ.get('APIFY_TOKEN', '')
IG_TOKEN         = os.environ.get('INSTAGRAM_ACCESS_TOKEN', '')
IG_USER_ID       = os.environ.get('INSTAGRAM_USER_ID', '')
FB_PAGE_TOKEN    = os.environ.get('FB_PAGE_TOKEN', '')
FB_PAGE_ID       = os.environ.get('FB_PAGE_ID', '')

APIFY_BASE = 'https://api.apify.com/v2'
GRAPH_BASE = 'https://graph.facebook.com/v19.0'

# ── Apify runner ──────────────────────────────────────────────
def run_actor(actor_id, input_data, timeout=120):
    if not APIFY_TOKEN:
        print('  ✗ APIFY_TOKEN manquant')
        return None
    url = f"{APIFY_BASE}/acts/{actor_id}/run-sync-get-dataset-items"
    params = {'token': APIFY_TOKEN, 'timeout': timeout, 'memory': 256}
    try:
        r = requests.post(url, params=params, json=input_data, timeout=timeout + 10)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f'  ✗ Apify erreur : {e}')
        return None

# ── TikTok via Apify ──────────────────────────────────────────
def scrape_tiktok():
    print('→ TikTok (Apify)…')
    items = run_actor('clockworks~tiktok-scraper', {
        'profiles': ['https://www.tiktok.com/@afder.recovery'],
        'resultsType': 'details',
        'maxProfilesPerQuery': 1,
    })
    if not items:
        return None
    p    = items[0]
    meta = p.get('authorMeta', {})
    followers = meta.get('fans', 0)
    likes_tot = meta.get('heart', 0)
    videos    = meta.get('video', 0)
    # engagement = likes totaux / (abonnés * vidéos) * 100
    eng = round(likes_tot / max(followers * max(videos, 1), 1) * 100, 2) if followers else 0
    result = {
        'platform':   'tiktok',
        'label':      'TikTok',
        'date':       TODAY,
        'followers':  followers,
        'likes':      likes_tot,
        'videos':     videos,
        'views':      meta.get('digg', p.get('playCount', 0)),
        'comments':   p.get('commentCount', 0),
        'shares':     p.get('shareCount', 0),
        'engagement': eng,
    }
    print(f"  ✓ {result['followers']:,} abonnés, {result['likes']:,} likes")
    return result

# ── Instagram via API Graph ───────────────────────────────────
def scrape_instagram():
    print('→ Instagram (API Graph)…')
    if not IG_TOKEN or not IG_USER_ID:
        print('  ✗ INSTAGRAM_ACCESS_TOKEN ou INSTAGRAM_USER_ID manquant')
        return None
    try:
        # Infos du compte
        fields = 'followers_count,media_count,name,username,biography'
        r = requests.get(
            f"{GRAPH_BASE}/{IG_USER_ID}",
            params={'fields': fields, 'access_token': IG_TOKEN},
            timeout=30
        )
        r.raise_for_status()
        account = r.json()

        # Stats des 10 derniers médias
        r2 = requests.get(
            f"{GRAPH_BASE}/{IG_USER_ID}/media",
            params={
                'fields': 'like_count,comments_count,impressions,reach',
                'limit': 10,
                'access_token': IG_TOKEN
            },
            timeout=30
        )
        r2.raise_for_status()
        media = r2.json().get('data', [])

        followers  = account.get('followers_count', 0)
        posts      = account.get('media_count', 0)
        avg_likes  = sum(m.get('like_count', 0) for m in media) / max(len(media), 1)
        avg_comm   = sum(m.get('comments_count', 0) for m in media) / max(len(media), 1)
        avg_reach  = sum(m.get('reach', 0) for m in media) / max(len(media), 1)
        avg_impr   = sum(m.get('impressions', 0) for m in media) / max(len(media), 1)
        eng        = round((avg_likes + avg_comm) / max(followers, 1) * 100, 2)

        result = {
            'platform':    'instagram',
            'label':       'Instagram',
            'date':        TODAY,
            'followers':   followers,
            'posts':       posts,
            'likes':       round(avg_likes * posts),
            'comments':    round(avg_comm  * posts),
            'reach':       round(avg_reach),
            'impressions': round(avg_impr),
            'engagement':  eng,
            'name':        account.get('name', ''),
            'username':    account.get('username', ''),
        }
        print(f"  ✓ {result['followers']:,} abonnés, {result['engagement']}% engagement")
        return result

    except Exception as e:
        print(f'  ✗ Instagram API erreur : {e}')
        return None

# ── Facebook FR via API Graph ─────────────────────────────────
def scrape_facebook_fr():
    print('→ Facebook France (API Graph)…')
    if not FB_PAGE_TOKEN or not FB_PAGE_ID:
        print('  ✗ FB_PAGE_TOKEN ou FB_PAGE_ID manquant')
        return None
    try:
        # Infos de la page
        fields = 'name,fan_count,followers_count,about'
        r = requests.get(
            f"{GRAPH_BASE}/{FB_PAGE_ID}",
            params={'fields': fields, 'access_token': FB_PAGE_TOKEN},
            timeout=30
        )
        r.raise_for_status()
        page = r.json()

        # Posts récents avec stats
        r2 = requests.get(
            f"{GRAPH_BASE}/{FB_PAGE_ID}/posts",
            params={
                'fields': 'message,likes.summary(true),comments.summary(true),shares',
                'limit': 10,
                'access_token': FB_PAGE_TOKEN
            },
            timeout=30
        )
        r2.raise_for_status()
        posts = r2.json().get('data', [])

        followers  = page.get('fan_count') or page.get('followers_count', 0)
        n_posts    = len(posts)
        total_likes    = sum(p.get('likes',    {}).get('summary', {}).get('total_count', 0) for p in posts)
        total_comments = sum(p.get('comments', {}).get('summary', {}).get('total_count', 0) for p in posts)
        total_shares   = sum((p.get('shares',  {}) or {}).get('count', 0) for p in posts)
        eng = round((total_likes + total_comments + total_shares) / max(n_posts, 1) / max(followers, 1) * 100, 2)

        result = {
            'platform':   'facebook_fr',
            'label':      'Facebook France',
            'date':       TODAY,
            'name':       page.get('name', 'AFDER France'),
            'followers':  followers,
            'posts':      n_posts,
            'likes':      total_likes,
            'comments':   total_comments,
            'shares':     total_shares,
            'engagement': eng,
        }
        print(f"  ✓ {result['followers']:,} abonnés, {result['likes']} likes sur {n_posts} posts")
        return result

    except Exception as e:
        print(f'  ✗ Facebook API erreur : {e}')
        return None

# ── Facebook ES via Apify ─────────────────────────────────────
def scrape_facebook_es():
    print('→ Facebook Espagne (Apify)…')
    items = run_actor('apify~facebook-pages-scraper', {
        'startUrls': [{'url': 'https://www.facebook.com/OldTimersRecovery/'}],
        'maxPosts': 10,
    })
    if not items:
        return None

    page  = next((i for i in items if i.get('likes') or i.get('title')), items[0])
    posts = [i for i in items if i.get('message') or i.get('text')]

    followers      = page.get('likes') or page.get('followers') or 0
    total_likes    = sum(i.get('likes',    0) for i in posts)
    total_comments = sum(i.get('comments', 0) for i in posts)
    total_shares   = sum(i.get('shares',   0) for i in posts)
    eng = round((total_likes + total_comments + total_shares) / max(len(posts), 1) / max(followers, 1) * 100, 2) if followers else 0

    result = {
        'platform':   'facebook_es',
        'label':      'Facebook Espagne',
        'date':       TODAY,
        'name':       page.get('title') or page.get('name') or 'Old Timers',
        'followers':  followers,
        'posts':      len(posts),
        'likes':      total_likes,
        'comments':   total_comments,
        'shares':     total_shares,
        'engagement': eng,
    }
    print(f"  ✓ {result['followers']:,} abonnés")
    return result

# ── Main ──────────────────────────────────────────────────────
def main():
    print(f"\n📊 Scraping AFDER — {TODAY}\n")

    scrapers = [
        scrape_tiktok,
        scrape_instagram,
        scrape_facebook_fr,
        scrape_facebook_es,
    ]

    results = []
    for scraper in scrapers:
        r = scraper()
        if r:
            results.append(r)
        time.sleep(2)

    if not results:
        print('\n✗ Aucun résultat — history.json non modifié')
        exit(1)

    # Charger l'historique existant
    history_file = 'history.json'
    try:
        with open(history_file, 'r', encoding='utf-8') as f:
            history = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        history = []

    # Supprimer les entrées du même jour
    history = [e for e in history if e.get('date') != TODAY]
    history.extend(results)
    history = sorted(history, key=lambda x: (x.get('date', ''), x.get('platform', '')))
    # Garder 2 ans max
    history = history[-104 * 4:]

    with open(history_file, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

    print(f"\n✅ history.json mis à jour — {len(results)} plateformes, {len(history)} entrées\n")

if __name__ == '__main__':
    main()
