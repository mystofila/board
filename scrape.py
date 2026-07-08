"""
scrape.py — Scraping AFDER
- TikTok       : Apify
- Facebook FR  : Apify
- Facebook ES  : Apify
- Instagram    : désactivé (pas d'accès)
"""

import os, json, time, requests
from datetime import datetime, timezone

TODAY       = datetime.now(timezone.utc).strftime('%Y-%m-%d')
APIFY_TOKEN = os.environ.get('APIFY_TOKEN', '')
APIFY_BASE  = 'https://api.apify.com/v2'

def run_actor(actor_id, input_data, timeout=120):
    if not APIFY_TOKEN:
        print('  ✗ APIFY_TOKEN manquant')
        return None
    url    = f"{APIFY_BASE}/acts/{actor_id}/run-sync-get-dataset-items"
    params = {'token': APIFY_TOKEN, 'timeout': timeout, 'memory': 256}
    try:
        r = requests.post(url, params=params, json=input_data, timeout=timeout + 10)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f'  ✗ Apify erreur : {e}')
        return None

def scrape_tiktok():
    print('→ TikTok…')
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
    likes     = meta.get('heart', 0)
    videos    = meta.get('video', 0)
    eng = round(likes / max(followers * max(videos, 1), 1) * 100, 2) if followers else 0
    result = {
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
    print(f"  ✓ {result['followers']:,} abonnés, {result['likes']:,} likes")
    return result

def scrape_facebook(platform, label, url):
    print(f'→ {label}…')
    items = run_actor('apify~facebook-pages-scraper', {
        'startUrls': [{'url': url}],
        'maxPosts': 10,
    })
    if not items:
        return None

    page  = next((i for i in items if i.get('likes') or i.get('followers') or i.get('title')), items[0])
    posts = [i for i in items if i.get('message') or i.get('text')]

    followers      = page.get('likes') or page.get('followers') or 0
    total_likes    = sum(i.get('likes',    0) for i in posts)
    total_comments = sum(i.get('comments', 0) for i in posts)
    total_shares   = sum(i.get('shares',   0) for i in posts)
    eng = round((total_likes + total_comments + total_shares) / max(len(posts), 1) / max(followers, 1) * 100, 2) if followers else 0

    result = {
        'platform':   platform,
        'label':      label,
        'date':       TODAY,
        'name':       page.get('title') or page.get('name') or label,
        'followers':  followers,
        'posts':      len(posts),
        'likes':      total_likes,
        'comments':   total_comments,
        'shares':     total_shares,
        'engagement': eng,
    }
    print(f"  ✓ {result['followers']:,} abonnés, {result['posts']} posts scrapés")
    return result

def main():
    print(f"\n📊 Scraping AFDER — {TODAY}\n")

    results = []

    r = scrape_tiktok()
    if r: results.append(r)
    time.sleep(3)

    r = scrape_facebook('facebook_fr', 'Facebook France', 'https://www.facebook.com/afder.recovery')
    if r: results.append(r)
    time.sleep(3)

    r = scrape_facebook('facebook_es', 'Facebook Espagne', 'https://www.facebook.com/OldTimersRecovery/')
    if r: results.append(r)

    if not results:
        print('\n✗ Aucun résultat — history.json non modifié')
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

    print(f"\n✅ {len(results)} plateformes, {len(history)} entrées au total\n")

if __name__ == '__main__':
    main()
