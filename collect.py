"""
collect.py — Collecte les stats via Apify et les ajoute dans history.json
Tourne chaque lundi via GitHub Actions.
"""

import os, json, requests
from datetime import date

TOKEN = os.environ.get('APIFY_TOKEN', '')
BASE  = 'https://api.apify.com/v2'
TODAY = str(date.today())

ACTORS = {
    'tiktok':      'clockworks~tiktok-scraper',
    'instagram':   'apify~instagram-scraper',
    'facebook_fr': 'apify~facebook-pages-scraper',
    'facebook_es': 'apify~facebook-pages-scraper',
}

HANDLES = {
    'tiktok':      {'profiles': ['https://www.tiktok.com/@afder.recovery'], 'resultsType': 'details', 'maxProfilesPerQuery': 1},
    'instagram':   {'usernames': ['afder.recovery'], 'resultsType': 'details', 'resultsLimit': 12},
    'facebook_fr': {'startUrls': [{'url': 'https://www.facebook.com/afder.recovery'}], 'maxPosts': 10},
    'facebook_es': {'startUrls': [{'url': 'https://www.facebook.com/OldTimersRecovery/'}], 'maxPosts': 10},
}

LABELS = {
    'tiktok':      'TikTok',
    'instagram':   'Instagram',
    'facebook_fr': 'Facebook France',
    'facebook_es': 'Facebook Espagne',
}


def run_actor(actor_id, input_data):
    url = f"{BASE}/acts/{actor_id}/run-sync-get-dataset-items"
    params = {'token': TOKEN, 'timeout': 120, 'memory': 256}
    r = requests.post(url, json=input_data, params=params, timeout=150)
    r.raise_for_status()
    return r.json()


def extract_tiktok(items):
    if not items:
        return {}
    p = items[0]
    meta = p.get('authorMeta', {})
    plays = sum(i.get('playCount', 0) for i in items)
    likes = sum(i.get('diggCount', 0) for i in items)
    comments = sum(i.get('commentCount', 0) for i in items)
    shares = sum(i.get('shareCount', 0) for i in items)
    return {
        'followers': meta.get('fans', 0),
        'likes':     meta.get('heart', 0),
        'videos':    meta.get('video', 0),
        'views':     plays,
        'comments':  comments,
        'shares':    shares,
        'engagement': round((likes + comments + shares) / plays * 100, 2) if plays else 0,
        'handle':    '@afder.recovery',
    }


def extract_instagram(items):
    if not items:
        return {}
    p = items[0]
    followers = p.get('followersCount') or p.get('followedByCount', 0)
    posts_count = p.get('postsCount') or p.get('mediaCount', 0)
    avg_likes = sum(i.get('likesCount', 0) for i in items) / len(items) if items else 0
    avg_comments = sum(i.get('commentsCount', 0) for i in items) / len(items) if items else 0
    eng = round((avg_likes + avg_comments) / followers * 100, 2) if followers else 0
    return {
        'followers':  followers,
        'posts':      posts_count,
        'likes':      round(avg_likes * posts_count),
        'comments':   round(avg_comments * posts_count),
        'engagement': eng,
        'handle':     '@' + (p.get('username') or 'afder.recovery'),
    }


def extract_facebook(items, label):
    if not items:
        return {}
    page = next((i for i in items if i.get('title') or i.get('name') or i.get('likes')), items[0])
    posts = [i for i in items if i.get('message') or i.get('text')]
    followers = page.get('likes') or page.get('followers', 0)
    total_likes    = sum(p.get('likes', 0) for p in posts)
    total_comments = sum(p.get('comments', 0) for p in posts)
    total_shares   = sum(p.get('shares', 0) for p in posts)
    eng = round((total_likes + total_comments + total_shares) / len(posts) / followers * 100, 2) if posts and followers else 0
    return {
        'followers':  followers,
        'name':       page.get('title') or page.get('name') or label,
        'posts':      len(posts),
        'likes':      total_likes,
        'comments':   total_comments,
        'shares':     total_shares,
        'engagement': eng,
    }


def collect():
    print(f"[{TODAY}] Démarrage de la collecte...")

    if not TOKEN:
        print("ERREUR : APIFY_TOKEN manquant dans les secrets GitHub.")
        return

    snapshot = {'date': TODAY, 'platforms': {}}

    for key, actor_id in ACTORS.items():
        print(f"  → {LABELS[key]}...")
        try:
            items = run_actor(actor_id, HANDLES[key])
            if key == 'tiktok':
                data = extract_tiktok(items)
            elif key == 'instagram':
                data = extract_instagram(items)
            else:
                data = extract_facebook(items, LABELS[key])

            data['platform'] = key
            data['label']    = LABELS[key]
            snapshot['platforms'][key] = data
            print(f"     ✓ {data.get('followers', 0)} abonnés")

        except Exception as e:
            print(f"     ✗ Erreur : {e}")
            snapshot['platforms'][key] = {'platform': key, 'label': LABELS[key], 'error': str(e)}

    # Charger l'historique existant
    history_file = 'history.json'
    try:
        with open(history_file, 'r') as f:
            history = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        history = []

    # Éviter les doublons pour la même date
    history = [h for h in history if h.get('date') != TODAY]
    history.append(snapshot)

    # Garder max 104 semaines (2 ans)
    history = history[-104:]

    with open(history_file, 'w') as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

    print(f"[{TODAY}] ✓ history.json mis à jour ({len(history)} entrées)")


if __name__ == '__main__':
    collect()
