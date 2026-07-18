"""
scrape.py — Scraping AFDER
- TikTok      : clockworks~tiktok-scraper (meilleur actor, 185k users)
- Facebook FR : API Graph officielle (abonnés + posts)
- Facebook ES : apify~facebook-pages-scraper (abonnés) + apify~facebook-posts-scraper (posts)
"""

import os, json, time, requests
from datetime import datetime, timezone

TODAY         = datetime.now(timezone.utc).strftime('%Y-%m-%d')
APIFY_TOKEN   = os.environ.get('APIFY_TOKEN', '')
FB_PAGE_TOKEN = os.environ.get('FB_PAGE_TOKEN', '')
FB_PAGE_ID    = os.environ.get('FB_PAGE_ID', '')
APIFY_BASE    = 'https://api.apify.com/v2'
GRAPH_BASE    = 'https://graph.facebook.com/v19.0'

def run_actor(actor_id, input_data, timeout=120):
    if not APIFY_TOKEN:
        print('  ✗ APIFY_TOKEN manquant')
        return None
    url    = f"{APIFY_BASE}/acts/{actor_id}/run-sync-get-dataset-items"
    params = {'token': APIFY_TOKEN, 'timeout': timeout, 'memory': 256}
    try:
        r = requests.post(url, params=params, json=input_data, timeout=timeout + 10)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, list):
            return data
        print(f'  ✗ Réponse inattendue : {str(data)[:200]}')
        return None
    except Exception as e:
        print(f'  ✗ Apify erreur ({actor_id}) : {e}')
        return None

# ── TikTok ────────────────────────────────────────────────────
def scrape_tiktok():
    print('→ TikTok (clockworks~tiktok-scraper)…')
    items = run_actor('clockworks~tiktok-scraper', {
        'profiles': ['https://www.tiktok.com/@afder.recovery'],
        'resultsType': 'details',
        'maxProfilesPerQuery': 1,
    })
    if not items:
        return None
    p         = items[0]
    meta      = p.get('authorMeta', {})
    followers = meta.get('fans', 0)
    likes     = meta.get('heart', 0)
    videos    = meta.get('video', 0)
    eng       = round(likes / max(followers * max(videos, 1), 1) * 100, 2) if followers else 0
    result    = {
        'platform':   'tiktok',
        'label':      'TikTok',
        'date':       TODAY,
        'followers':  followers,
        'likes':      likes,
        'videos':     videos,
        'comments':   p.get('commentCount', 0),
        'shares':     p.get('shareCount', 0),
        'engagement': eng,
    }
    print(f"  ✓ {followers:,} abonnés · {likes:,} likes · {videos} vidéos")
    return result

# ── Facebook FR via API Graph ─────────────────────────────────
def scrape_facebook_fr():
    print('→ Facebook France (API Graph)…')
    if not FB_PAGE_TOKEN or not FB_PAGE_ID:
        print('  ✗ FB_PAGE_TOKEN ou FB_PAGE_ID manquant')
        return None
    try:
        # Abonnés
        r = requests.get(
            f"{GRAPH_BASE}/{FB_PAGE_ID}",
            params={'fields': 'name,fan_count,followers_count', 'access_token': FB_PAGE_TOKEN},
            timeout=30
        )
        r.raise_for_status()
        page = r.json()
        if 'error' in page:
            print(f"  ✗ {page['error'].get('message')}")
            return None
        followers = page.get('fan_count') or page.get('followers_count') or 0

        # Posts + réactions
        r2 = requests.get(
            f"{GRAPH_BASE}/{FB_PAGE_ID}/feed",
            params={
                'fields': 'reactions.summary(true),comments.summary(true),shares',
                'limit': 20,
                'access_token': FB_PAGE_TOKEN,
            },
            timeout=30
        )
        r2.raise_for_status()
        posts = r2.json().get('data', [])

        total_reactions = sum(p.get('reactions', {}).get('summary', {}).get('total_count', 0) for p in posts)
        total_comments  = sum(p.get('comments',  {}).get('summary', {}).get('total_count', 0) for p in posts)
        total_shares    = sum((p.get('shares') or {}).get('count', 0) for p in posts)
        n   = len(posts)
        eng = round((total_reactions + total_comments + total_shares) / max(n, 1) / max(followers, 1) * 100, 2) if followers else 0

        result = {
            'platform':   'facebook_fr',
            'label':      'Facebook France',
            'date':       TODAY,
            'name':       page.get('name', 'AFDER France'),
            'followers':  followers,
            'posts':      n,
            'likes':      total_reactions,
            'comments':   total_comments,
            'shares':     total_shares,
            'engagement': eng,
        }
        print(f"  ✓ {followers:,} abonnés · {n} posts · {total_reactions} réactions")
        return result
    except Exception as e:
        print(f'  ✗ Facebook API erreur : {e}')
        return None

# ── Facebook ES via Apify (2 actors) ─────────────────────────
def scrape_facebook_es():
    print('→ Facebook Espagne (Apify)…')
    URL = 'https://www.facebook.com/OldTimersRecovery/'

    # 1. Abonnés via facebook-pages-scraper
    followers = 0
    name      = 'Old Timers'
    page_items = run_actor('apify~facebook-pages-scraper', {
        'startUrls': [{'url': URL}],
        'maxPosts': 0,
    })
    if page_items:
        page = next((i for i in page_items if i.get('likes') or i.get('followers') or i.get('title')), page_items[0])
        followers = page.get('likes') or page.get('followers') or 0
        name      = page.get('title') or page.get('name') or name
        print(f"  ✓ Page : {followers:,} abonnés")

    # 2. Posts via facebook-posts-scraper
    total_likes = total_comments = total_shares = n = 0
    post_items = run_actor('apify~facebook-posts-scraper', {
        'startUrls': [{'url': URL}],
        'maxPosts': 10,
    })
    if post_items:
        posts = [i for i in post_items if isinstance(i, dict) and (i.get('text') or i.get('postText') or i.get('message'))]
        n              = len(posts)
        total_likes    = sum(i.get('likes', 0) for i in posts)
        total_comments = sum(i.get('comments', 0) for i in posts)
        total_shares   = sum(i.get('shares', 0) for i in posts)
        print(f"  ✓ Posts : {n} posts · {total_likes} likes")

    eng = round((total_likes + total_comments + total_shares) / max(n, 1) / max(followers, 1) * 100, 2) if followers else 0

    return {
        'platform':   'facebook_es',
        'label':      'Facebook Espagne',
        'date':       TODAY,
        'name':       name,
        'followers':  followers,
        'posts':      n,
        'likes':      total_likes,
        'comments':   total_comments,
        'shares':     total_shares,
        'engagement': eng,
    }

# ── Main ──────────────────────────────────────────────────────

# ── Instagram via Apify (public, sans login) ──────────────────
def scrape_instagram():
    print('→ Instagram (Apify, sans login)…')

    # Essai 1 : parseforge~instagram-profile-scraper (mis à jour avril 2026)
    items = run_actor('parseforge~instagram-profile-scraper', {
        'usernames': ['afder.recovery'],
    })
    if items:
        p         = items[0]
        followers = p.get('followersCount') or p.get('followers') or p.get('followerCount') or 0
        posts     = p.get('postsCount') or p.get('mediaCount') or p.get('posts') or 0
        if followers:
            print(f'  ✓ (actor 1) {followers:,} abonnés · {posts} posts')
            return {
                'platform':   'instagram',
                'label':      'Instagram',
                'date':       TODAY,
                'name':       p.get('fullName') or p.get('username') or 'AFDER Recovery',
                'followers':  followers,
                'posts':      posts,
                'likes':      0,
                'comments':   0,
                'engagement': 0,
            }

    print('  ↩ Actor 1 vide, essai actor 2…')

    # Essai 2 : automation-lab~instagram-followers-count-bulk-scraper (API mobile Instagram)
    items = run_actor('automation-lab~instagram-followers-count-bulk-scraper', {
        'usernames': ['afder.recovery'],
    })
    if items:
        p         = items[0]
        followers = p.get('followersCount') or p.get('followers') or p.get('followerCount') or 0
        posts     = p.get('postsCount') or p.get('mediaCount') or 0
        if followers:
            print(f'  ✓ (actor 2) {followers:,} abonnés · {posts} posts')
            return {
                'platform':   'instagram',
                'label':      'Instagram',
                'date':       TODAY,
                'name':       p.get('fullName') or p.get('username') or 'AFDER Recovery',
                'followers':  followers,
                'posts':      posts,
                'likes':      0,
                'comments':   0,
                'engagement': 0,
            }

    print('  ✗ Instagram introuvable sur les deux actors')
    return None



def main():
    print(f"\n📊 Scraping AFDER — {TODAY}\n")

    results = []
    for scraper in [scrape_tiktok, scrape_instagram, scrape_facebook_fr, scrape_facebook_es]:
        r = scraper()
        if r:
            results.append(r)
        time.sleep(3)

    if not results:
        print('\n✗ Aucun résultat')
        exit(1)

    history_file = 'history.json'
    try:
        with open(history_file, 'r', encoding='utf-8') as f:
            history = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        history = []

    history = [e for e in history if e.get('date') != TODAY]
    history.extend(results)
    history = sorted(history, key=lambda x: (x.get('date', ''), x.get('platform', '')))
    history = history[-(104 * 4):]

    with open(history_file, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

    print(f"\n✅ {len(results)} plateformes · {len(history)} entrées au total\n")

if __name__ == '__main__':
    main()
