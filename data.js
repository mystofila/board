/**
 * data.js — ApifyAPI
 * Plateformes : tiktok, instagram, facebook_fr, facebook_es
 */

const ApifyConfig = {
  token: localStorage.getItem('apify_token') || 'APIFY_TOKEN_ICI',
  baseUrl: 'https://api.apify.com/v2',
  actors: {
    tiktok:    'clockworks~tiktok-scraper',
    instagram: 'apify~instagram-scraper',
    facebook:  'apify~facebook-pages-scraper',
  },
  handles: {
    tiktok:       'https://www.tiktok.com/@afder.recovery',
    instagram:    'afder.recovery',
    facebook_fr:  'https://www.facebook.com/afder.recovery',
    facebook_es:  'https://www.facebook.com/OldTimersRecovery/',
  },
  cacheTTL: 7 * 24 * 60 * 60 * 1000,
};

const Cache = {
  get(key) {
    try {
      const raw = localStorage.getItem(`apify_cache_${key}`);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > ApifyConfig.cacheTTL) { localStorage.removeItem(`apify_cache_${key}`); return null; }
      return data;
    } catch { return null; }
  },
  set(key, data) {
    try { localStorage.setItem(`apify_cache_${key}`, JSON.stringify({ ts: Date.now(), data })); } catch {}
  },
  clear() {
    Object.keys(localStorage).filter(k => k.startsWith('apify_cache_')).forEach(k => localStorage.removeItem(k));
  },
  age(key) {
    try {
      const raw = localStorage.getItem(`apify_cache_${key}`);
      if (!raw) return null;
      const { ts } = JSON.parse(raw);
      const diff = Date.now() - ts;
      const h = Math.floor(diff / 3600000);
      const d = Math.floor(h / 24);
      return d > 0 ? `il y a ${d}j` : h > 0 ? `il y a ${h}h` : 'à l\'instant';
    } catch { return null; }
  }
};

async function runApifyActor(actorId, input) {
  if (!ApifyConfig.token || ApifyConfig.token === 'APIFY_TOKEN_ICI') throw new Error('Token non configuré');
  const url = `${ApifyConfig.baseUrl}/acts/${actorId}/run-sync-get-dataset-items?token=${ApifyConfig.token}&timeout=120&memory=256`;
  const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(input) });
  if (!res.ok) throw new Error(`Apify ${res.status}`);
  return res.json();
}

// ── Scraper Facebook générique pour une page ──────────────────
async function scrapeFacebookPage(cacheKey, url, label) {
  const cached = Cache.get(cacheKey);
  if (cached) return cached;

  const items = await runApifyActor(ApifyConfig.actors.facebook, {
    startUrls: [{ url }], maxPosts: 10,
  });
  if (!items || !items.length) throw new Error(`${label}: aucun résultat`);

  const page = items.find(i => i.title || i.name || i.likes) || items[0];
  const posts = items.filter(i => i.message || i.text);

  const result = {
    platform:    cacheKey,
    name:        page.title || page.name || label,
    handle:      url,
    followers:   page.likes || page.followers || 0,
    posts:       posts.length,
    likes:       posts.reduce((s,p)=>s+(p.likes||0),0),
    comments:    posts.reduce((s,p)=>s+(p.comments||0),0),
    shares:      posts.reduce((s,p)=>s+(p.shares||0),0),
    engagement:  calcFBEngagement(posts, page.likes||page.followers||1),
    verified:    page.verified || false,
    lastUpdated: new Date().toISOString(),
    rawPosts:    posts.slice(0,10).map(normalizePost(cacheKey)),
  };
  Cache.set(cacheKey, result);
  return result;
}

const Scrapers = {
  async tiktok() {
    const cached = Cache.get('tiktok');
    if (cached) return cached;
    const items = await runApifyActor(ApifyConfig.actors.tiktok, {
      profiles: [ApifyConfig.handles.tiktok], resultsType:'details', maxProfilesPerQuery:1,
    });
    if (!items || !items.length) throw new Error('TikTok: aucun résultat');
    const p = items[0];
    const result = {
      platform: 'tiktok',
      name:     p.authorMeta?.name || 'AFDER Recovery',
      handle:   '@afder.recovery',
      followers: p.authorMeta?.fans || 0,
      likes:     p.authorMeta?.heart || 0,
      videos:    p.authorMeta?.video || 0,
      views:     p.playCount || 0,
      comments:  p.commentCount || 0,
      shares:    p.shareCount || 0,
      engagement: calcEngagement(p.likeCount, p.commentCount, p.shareCount, p.playCount),
      verified:  p.authorMeta?.verified || false,
      lastUpdated: new Date().toISOString(),
      rawPosts:  items.slice(0,10).map(normalizePost('tiktok')),
    };
    Cache.set('tiktok', result);
    return result;
  },

  async instagram() {
    const cached = Cache.get('instagram');
    if (cached) return cached;
    const items = await runApifyActor(ApifyConfig.actors.instagram, {
      usernames: [ApifyConfig.handles.instagram], resultsType:'details', resultsLimit:12,
    });
    if (!items || !items.length) throw new Error('Instagram: aucun résultat');
    const p = items[0];
    const result = {
      platform:  'instagram',
      name:      p.fullName || 'AFDER Recovery',
      handle:    '@' + (p.username || ApifyConfig.handles.instagram),
      followers: p.followersCount || p.followedByCount || 0,
      posts:     p.postsCount || p.mediaCount || 0,
      likes:     avgField(items, 'likesCount') * (p.postsCount || 1),
      views:     avgField(items, 'videoViewCount') * (p.postsCount || 1),
      comments:  avgField(items, 'commentsCount') * (p.postsCount || 1),
      engagement: calcIGEngagement(items, p.followersCount),
      verified:  p.verified || false,
      lastUpdated: new Date().toISOString(),
      rawPosts:  items.slice(0,10).map(normalizePost('instagram')),
    };
    Cache.set('instagram', result);
    return result;
  },

  async facebook_fr() {
    return scrapeFacebookPage('facebook_fr', ApifyConfig.handles.facebook_fr, 'AFDER France');
  },

  async facebook_es() {
    return scrapeFacebookPage('facebook_es', ApifyConfig.handles.facebook_es, 'AFDER Espagne');
  },
};

// ── Helpers ───────────────────────────────────────────────────
function normalizePost(platform) {
  return (item) => ({
    platform,
    title:    item.text || item.caption || item.description || item.message || item.title || '(sans titre)',
    likes:    item.likesCount || item.diggCount || item.likes || 0,
    views:    item.videoViewCount || item.playCount || item.views || 0,
    comments: item.commentsCount || item.commentCount || item.comments || 0,
    shares:   item.shareCount || item.shares || 0,
    date:     item.timestamp ? new Date(item.timestamp*1000).toISOString().split('T')[0]
              : item.taken_at_timestamp ? new Date(item.taken_at_timestamp*1000).toISOString().split('T')[0] : '',
    engagement: calcEngagement(item.likesCount||item.diggCount, item.commentsCount||item.commentCount, item.shareCount, item.videoViewCount||item.playCount),
  });
}

function calcEngagement(likes=0, comments=0, shares=0, views=1) {
  if (!views) return 0;
  return parseFloat(((likes+comments+shares)/views*100).toFixed(2));
}
function calcIGEngagement(posts, followers) {
  if (!followers||!posts.length) return 0;
  const avg = posts.reduce((s,p)=>s+(p.likesCount||0)+(p.commentsCount||0),0)/posts.length;
  return parseFloat((avg/followers*100).toFixed(2));
}
function calcFBEngagement(posts, followers) {
  if (!followers||!posts.length) return 0;
  const avg = posts.reduce((s,p)=>s+(p.likes||0)+(p.comments||0)+(p.shares||0),0)/posts.length;
  return parseFloat((avg/followers*100).toFixed(2));
}
function avgField(arr, field) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((s,i)=>s+(i[field]||0),0)/arr.length);
}

// ── MockAPI ───────────────────────────────────────────────────
const MockAPI = {
  _data: { tiktok:null, instagram:null, facebook_fr:null, facebook_es:null },
  _loading: false,
  _callbacks: [],

  async loadAll(force=false) {
    if (this._loading) return;
    this._loading = true;
    this._notify('loading', null);
    const platforms = ['tiktok','instagram','facebook_fr','facebook_es'];
    const results = {};

    for (const plat of platforms) {
      try {
        if (!force && Cache.get(plat)) {
          results[plat] = Cache.get(plat);
          this._data[plat] = results[plat];
          this._notify('partial', { platform:plat, data:results[plat], cached:true });
          continue;
        }
        if (!ApifyConfig.token || ApifyConfig.token==='APIFY_TOKEN_ICI') {
          results[plat] = null;
        } else {
          results[plat] = await Scrapers[plat]();
        }
        this._data[plat] = results[plat];
        this._notify('partial', { platform:plat, data:results[plat], cached:false });
      } catch(err) {
        console.warn(`[Apify] ${plat}:`, err.message);
        results[plat] = null;
        this._data[plat] = null;
        this._notify('partial', { platform:plat, data:null, error:err.message });
      }
    }
    this._loading = false;
    this._notify('done', results);
    return results;
  },

  on(fn) { this._callbacks.push(fn); },
  _notify(type, payload) { this._callbacks.forEach(fn => { try { fn(type,payload); } catch {} }); },

  getPlatforms() {
    return {
      tiktok:      this._data.tiktok      || null,
      instagram:   this._data.instagram   || null,
      facebook_fr: this._data.facebook_fr || null,
      facebook_es: this._data.facebook_es || null,
    };
  },

  getTopPosts() {
    const all = [];
    Object.entries(this._data).forEach(([key, p]) => {
      if (p && p.rawPosts) all.push(...p.rawPosts);
    });
    return all.sort((a,b)=>(b.likes||0)-(a.likes||0)).slice(0,20);
  },

  getHistory() {
    const all = [];
    Object.entries(this._data).forEach(([key, p]) => {
      if (p && p.rawPosts) p.rawPosts.forEach((post,i) => all.push({ id:all.length+1, ...post }));
    });
    return all.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  },

  getAlerts() {
    const alerts = [];
    let id = 1;
    const plat = this.getPlatforms();
    if (!ApifyConfig.token || ApifyConfig.token==='APIFY_TOKEN_ICI') {
      alerts.push({ id:id++, type:'info', icon:'⚙️', title:'Token Apify non configuré', desc:'Allez dans Paramètres et collez votre token pour récupérer les vraies données.', time:'Maintenant', read:false });
    }
    if (plat.tiktok && plat.tiktok.followers > 10000) {
      alerts.push({ id:id++, type:'record', icon:'🏆', title:`TikTok — ${this.fmt(plat.tiktok.followers)} abonnés`, desc:'', time:plat.tiktok.lastUpdated ? new Date(plat.tiktok.lastUpdated).toLocaleDateString('fr-FR') : '', read:false });
    }
    if (plat.instagram && plat.instagram.engagement < 3) {
      alerts.push({ id:id++, type:'warning', icon:'📉', title:'Engagement Instagram faible', desc:`Taux actuel : ${plat.instagram.engagement}%`, time:'', read:false });
    }
    return alerts;
  },

  setToken(token) { ApifyConfig.token = token; localStorage.setItem('apify_token', token); },
  clearCache() { Cache.clear(); },

  fmt(n) {
    if (n>=1_000_000) return (n/1_000_000).toFixed(1)+'M';
    if (n>=1_000)     return (n/1_000).toFixed(1)+'k';
    return String(Math.round(n)||0);
  },

  COLORS: {
    tiktok:      '#FF0050',
    instagram:   '#E1306C',
    facebook_fr: '#1877F2',
    facebook_es: '#0A5DC2',
  },
  ICONS: {
    tiktok:      '🎵',
    instagram:   '📸',
    facebook_fr: '🇫🇷',
    facebook_es: '🇪🇸',
  },
  LABELS: {
    tiktok:      'TikTok',
    instagram:   'Instagram',
    facebook_fr: 'Facebook France',
    facebook_es: 'Facebook Espagne',
  },
};
