/**
 * data.js — ApifyAPI + fallback MockData
 * ============================================================
 * Récupère les vraies données publiques via Apify scrapers.
 * Si Apify n'est pas configuré → fallback sur données simulées.
 *
 * ACTORS UTILISÉS :
 *   TikTok   : clockworks/tiktok-scraper
 *   Instagram: apify/instagram-scraper
 *   Facebook : apify/facebook-pages-scraper
 *   LinkedIn : (profil public scraping via restli scraper)
 *
 * POUR CONFIGURER :
 *   1. Créer un compte gratuit sur https://apify.com
 *   2. Copier ton token depuis Console > Integrations
 *   3. Coller dans le champ "Token Apify" de l'onglet Paramètres
 * ============================================================
 */

// ── Config ────────────────────────────────────────────────────
const ApifyConfig = {
  token: localStorage.getItem('apify_token') || 'APIFY_TOKEN_ICI',
  baseUrl: 'https://api.apify.com/v2',

  // Actors Apify (IDs stables)
  actors: {
    tiktok:    'clockworks~tiktok-scraper',
    instagram: 'apify~instagram-scraper',
    facebook:  'apify~facebook-pages-scraper',
    linkedin:  'anchor~linkedin-people-profiles',
  },

  // Handles publics AFDER (modifiables dans Paramètres)
  handles: {
    tiktok:    'https://www.tiktok.com/@afder.recovery',
    instagram: 'afder.recovery',
    facebook:  ['https://www.facebook.com/afder.recovery', 'https://www.facebook.com/OldTimersRecovery/'],
    linkedin:  'https://www.linkedin.com/company/afder/',
  },

  // Cache local 7 jours
  cacheTTL: 7 * 24 * 60 * 60 * 1000,
};

// ── Cache helpers ─────────────────────────────────────────────
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

// ── Apify runner ──────────────────────────────────────────────
async function runApifyActor(actorId, input) {
  if (!ApifyConfig.token) throw new Error('Token Apify non configuré');

  const url = `${ApifyConfig.baseUrl}/acts/${actorId}/run-sync-get-dataset-items?token=${ApifyConfig.token}&timeout=120&memory=256`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Apify error ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

// ── Platform scrapers ─────────────────────────────────────────
const Scrapers = {

  async tiktok() {
    const cached = Cache.get('tiktok');
    if (cached) return cached;

    const items = await runApifyActor(ApifyConfig.actors.tiktok, {
      profiles: [ApifyConfig.handles.tiktok],
      resultsType: 'details',
      maxProfilesPerQuery: 1,
    });

    if (!items || !items.length) throw new Error('TikTok: aucun résultat');
    const p = items[0];

    const result = {
      platform:    'tiktok',
      name:        p.authorMeta?.name || 'AFDER Recovery',
      handle:      ApifyConfig.handles.tiktok,
      followers:   p.authorMeta?.fans        || p.followerCount || 0,
      following:   p.authorMeta?.following   || 0,
      likes:       p.authorMeta?.heart       || p.likeCount || 0,
      videos:      p.authorMeta?.video       || p.videoCount || 0,
      views:       p.playCount               || 0,
      comments:    p.commentCount            || 0,
      shares:      p.shareCount              || 0,
      engagement:  calcEngagement(p.likeCount, p.commentCount, p.shareCount, p.playCount),
      bio:         p.authorMeta?.signature   || '',
      verified:    p.authorMeta?.verified    || false,
      lastUpdated: new Date().toISOString(),
      rawPosts:    items.slice(0, 10).map(normalizePost('tiktok')),
    };

    Cache.set('tiktok', result);
    return result;
  },

  async instagram() {
    const cached = Cache.get('instagram');
    if (cached) return cached;

    const items = await runApifyActor(ApifyConfig.actors.instagram, {
      usernames: [ApifyConfig.handles.instagram],
      resultsType: 'details',
      resultsLimit: 12,
    });

    if (!items || !items.length) throw new Error('Instagram: aucun résultat');
    const p = items[0];

    const result = {
      platform:    'instagram',
      name:        p.fullName          || 'AFDER Recovery',
      handle:      '@' + (p.username || ApifyConfig.handles.instagram),
      followers:   p.followersCount    || p.followedByCount || 0,
      following:   p.followsCount      || p.followCount || 0,
      posts:       p.postsCount        || p.mediaCount || 0,
      likes:       avgField(items, 'likesCount') * (p.postsCount || 1),
      views:       avgField(items, 'videoViewCount') * (p.postsCount || 1),
      comments:    avgField(items, 'commentsCount') * (p.postsCount || 1),
      engagement:  calcIGEngagement(items, p.followersCount),
      bio:         p.biography         || '',
      verified:    p.verified          || false,
      website:     p.externalUrl       || '',
      lastUpdated: new Date().toISOString(),
      rawPosts:    items.slice(0, 10).map(normalizePost('instagram')),
    };

    Cache.set('instagram', result);
    return result;
  },

  async facebook() {
    const cached = Cache.get('facebook');
    if (cached) return cached;

    // Scrape les 2 pages Facebook AFDER
    const urls = Array.isArray(ApifyConfig.handles.facebook)
      ? ApifyConfig.handles.facebook
      : [ApifyConfig.handles.facebook];

    const items = await runApifyActor(ApifyConfig.actors.facebook, {
      startUrls: urls.map(url => ({ url })),
      maxPosts: 10,
    });

    if (!items || !items.length) throw new Error('Facebook: aucun résultat');

    // Fusionner les 2 pages
    const pages = items.filter(i => i.title || i.name || i.likes);
    const totalLikes    = pages.reduce((s, p) => s + (p.likes || p.followers || 0), 0);
    const totalComments = sumField(items, 'comments');
    const totalShares   = sumField(items, 'shares');
    const totalPostLikes= sumField(items, 'likes');

    const result = {
      platform:    'facebook',
      name:        pages.map(p => p.title || p.name).filter(Boolean).join(' + ') || 'AFDER Facebook',
      handle:      urls.join(' · '),
      followers:   totalLikes,
      posts:       items.length,
      likes:       totalPostLikes,
      comments:    totalComments,
      shares:      totalShares,
      engagement:  calcFBEngagement(items, totalLikes),
      bio:         pages[0]?.about || '',
      verified:    pages.some(p => p.verified),
      lastUpdated: new Date().toISOString(),
      rawPosts:    items.slice(0, 10).map(normalizePost('facebook')),
      pages:       pages.map(p => ({ name: p.title||p.name, followers: p.likes||p.followers||0, url: p.pageUrl||'' })),
    };

    Cache.set('facebook', result);
    return result;
  },

  // LinkedIn : profils publics très limités sans login
  // On utilise les données mockées enrichies par l'IA si pas de scraping possible
  async linkedin() {
    const cached = Cache.get('linkedin');
    if (cached) return cached;
    // LinkedIn bloque quasi tout le scraping public → fallback simulé réaliste
    const result = MockData.platforms.linkedin;
    result.lastUpdated = new Date().toISOString();
    result.note = 'LinkedIn restreint le scraping public — données estimées';
    Cache.set('linkedin', result);
    return result;
  },
};

// ── Normalizers ───────────────────────────────────────────────
function normalizePost(platform) {
  return (item) => ({
    platform,
    title:      item.text || item.caption || item.description || item.title || '(sans titre)',
    likes:      item.likesCount || item.diggCount || item.likes || 0,
    views:      item.videoViewCount || item.playCount || item.views || 0,
    comments:   item.commentsCount || item.commentCount || item.comments || 0,
    shares:     item.shareCount || item.shares || 0,
    date:       item.timestamp ? new Date(item.timestamp * 1000).toISOString().split('T')[0]
                               : (item.taken_at_timestamp ? new Date(item.taken_at_timestamp*1000).toISOString().split('T')[0] : ''),
    url:        item.url || item.shortCode ? `https://www.instagram.com/p/${item.shortCode}` : '',
    engagement: calcEngagement(item.likesCount||item.diggCount, item.commentsCount||item.commentCount, item.shareCount, item.videoViewCount||item.playCount),
  });
}

function calcEngagement(likes=0, comments=0, shares=0, views=1) {
  if (!views) return 0;
  return parseFloat(((likes + comments + shares) / views * 100).toFixed(2));
}

function calcIGEngagement(posts, followers) {
  if (!followers || !posts.length) return 0;
  const avg = posts.reduce((s, p) => s + (p.likesCount||0) + (p.commentsCount||0), 0) / posts.length;
  return parseFloat((avg / followers * 100).toFixed(2));
}

function calcFBEngagement(posts, followers) {
  if (!followers || !posts.length) return 0;
  const avg = posts.reduce((s, p) => s + (p.likes||0) + (p.comments||0) + (p.shares||0), 0) / posts.length;
  return parseFloat((avg / followers * 100).toFixed(2));
}

function avgField(arr, field) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((s, i) => s + (i[field]||0), 0) / arr.length);
}

function sumField(arr, field) {
  return arr.reduce((s, i) => s + (i[field]||0), 0);
}

// ── Mock fallback data ────────────────────────────────────────
const MockData = {
  platforms: {
    tiktok:    { platform:'tiktok',    name:'AFDER Recovery', handle:'@afder.recovery', followers:18400, likes:41200, views:284000, comments:3800, shares:7200, engagement:4.8, posts:127, verified:false, lastUpdated:null, note:'Données simulées — configurez Apify pour les vraies données' },
    instagram: { platform:'instagram', name:'AFDER Recovery', handle:'@afder.recovery', followers:9250,  likes:18600, views:142000, comments:1240, shares:2800, engagement:3.4, posts:89,  verified:false, lastUpdated:null, note:'Données simulées' },
    facebook:  { platform:'facebook',  name:'AFDER',          handle:'afder.recovery',  followers:6120,  likes:7400,  views:78000,  comments:890,  shares:1900, engagement:2.1, posts:204, verified:false, lastUpdated:null, note:'Données simulées' },
    linkedin:  { platform:'linkedin',  name:'AFDER',          handle:'afder',           followers:2380,  likes:3200,  views:34000,  comments:480,  shares:940,  engagement:5.6, posts:41,  verified:false, lastUpdated:null, note:'LinkedIn restreint le scraping — données estimées' },
  },
  genSeries(n, base, variance, trend=1) {
    const out = []; let val = base;
    for (let i = 0; i < n; i++) { val += (Math.random()-0.45)*variance + trend; out.push(Math.max(0, Math.round(val))); }
    return out;
  },
};

// ── MockAPI public (interface stable pour app.js / charts.js) ─
const MockAPI = {
  // État global chargé
  _data: { tiktok: null, instagram: null, facebook: null, linkedin: null },
  _loading: false,
  _callbacks: [],

  // ── Chargement principal ────────────────────────────────────
  async loadAll(force = false) {
    if (this._loading) return;
    this._loading = true;
    this._notify('loading', null);

    const platforms = ['tiktok', 'instagram', 'facebook', 'linkedin'];
    const results = {};

    for (const plat of platforms) {
      try {
        if (!force && Cache.get(plat)) {
          results[plat] = Cache.get(plat);
          this._data[plat] = results[plat];
          this._notify('partial', { platform: plat, data: results[plat], cached: true });
          continue;
        }

        if (!ApifyConfig.token) {
          results[plat] = MockData.platforms[plat];
        } else {
          results[plat] = await Scrapers[plat]();
        }

        this._data[plat] = results[plat];
        this._notify('partial', { platform: plat, data: results[plat], cached: false });

      } catch (err) {
        console.warn(`[Apify] ${plat} failed:`, err.message);
        results[plat] = { ...MockData.platforms[plat], error: err.message };
        this._data[plat] = results[plat];
        this._notify('partial', { platform: plat, data: results[plat], error: err.message });
      }
    }

    this._loading = false;
    this._notify('done', results);
    return results;
  },

  // ── Callbacks ───────────────────────────────────────────────
  on(fn) { this._callbacks.push(fn); },
  _notify(type, payload) { this._callbacks.forEach(fn => { try { fn(type, payload); } catch {} }); },

  // ── Getters ─────────────────────────────────────────────────
  getPlatforms() {
    const d = this._data;
    return {
      tiktok:    d.tiktok    || MockData.platforms.tiktok,
      instagram: d.instagram || MockData.platforms.instagram,
      facebook:  d.facebook  || MockData.platforms.facebook,
      linkedin:  d.linkedin  || MockData.platforms.linkedin,
    };
  },

  getStats(period) {
    const plat = this.getPlatforms();
    const totalFollowers = (plat.tiktok.followers||0) + (plat.instagram.followers||0) + (plat.facebook.followers||0) + (plat.linkedin.followers||0);
    const totalViews     = (plat.tiktok.views||0) + (plat.instagram.views||0) + (plat.facebook.views||0) + (plat.linkedin.views||0);
    const totalLikes     = (plat.tiktok.likes||0) + (plat.instagram.likes||0) + (plat.facebook.likes||0) + (plat.linkedin.likes||0);
    const avgEngagement  = parseFloat(((plat.tiktok.engagement + plat.instagram.engagement + plat.facebook.engagement + plat.linkedin.engagement) / 4).toFixed(1));

    const mult = { day:1, week:7, month:30, year:365 }[period] || 7;
    const gen  = (base, v, t) => MockData.genSeries(period==='year'?12:period==='month'?30:period==='week'?7:24, base, v, t);

    return {
      followers:  { value: totalFollowers, change: +2.4,         sparkData: gen(totalFollowers * 0.94, totalFollowers*0.01, totalFollowers*0.0002) },
      views:      { value: Math.round(totalViews/365*mult), change: +8.1,  sparkData: gen(totalViews/365*mult*0.9, totalViews/365*mult*0.05, totalViews/365*mult*0.003) },
      likes:      { value: Math.round(totalLikes/365*mult), change: +5.3,  sparkData: gen(totalLikes/365*mult*0.9, totalLikes/365*mult*0.05, totalLikes/365*mult*0.003) },
      engagement: { value: avgEngagement, change: -0.3,           sparkData: gen(avgEngagement*0.95, 0.3, 0) },
      growth:     { value: Math.round(totalFollowers * 0.038 / 365 * mult), change: +12, sparkData: gen(50, 20, 1) },
    };
  },

  getFollowersChart(period) {
    const plat = this.getPlatforms();
    const n    = { day:24, week:7, month:30, year:12 }[period] || 7;
    const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    const labels  = period==='year' ? MONTHS
      : period==='month' ? Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-29+i);return`${d.getDate()}/${d.getMonth()+1}`;})
      : period==='week' ? ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'].slice(0,7)
      : Array.from({length:24},(_,i)=>`${i}h`);
    return {
      labels,
      datasets: {
        tiktok:    MockData.genSeries(n, plat.tiktok.followers    * 0.92, plat.tiktok.followers    * 0.01, plat.tiktok.followers    * 0.0005 * (period==='year'?20:1)),
        instagram: MockData.genSeries(n, plat.instagram.followers * 0.92, plat.instagram.followers * 0.01, plat.instagram.followers * 0.0005 * (period==='year'?20:1)),
        facebook:  MockData.genSeries(n, plat.facebook.followers  * 0.92, plat.facebook.followers  * 0.01, plat.facebook.followers  * 0.0003 * (period==='year'?20:1)),
        linkedin:  MockData.genSeries(n, plat.linkedin.followers  * 0.92, plat.linkedin.followers  * 0.01, plat.linkedin.followers  * 0.0004 * (period==='year'?20:1)),
      }
    };
  },

  getEngagementChart(period) {
    const plat = this.getPlatforms();
    const n = {day:24,week:7,month:30,year:12}[period]||7;
    const labels = this.getFollowersChart(period).labels;
    return {
      labels,
      tiktok:    MockData.genSeries(n, plat.tiktok.engagement,    0.5),
      instagram: MockData.genSeries(n, plat.instagram.engagement, 0.4),
      facebook:  MockData.genSeries(n, plat.facebook.engagement,  0.3),
      linkedin:  MockData.genSeries(n, plat.linkedin.engagement,  0.6),
    };
  },

  getReachChart(period) {
    const plat = this.getPlatforms();
    const totalViews = (plat.tiktok.views||0) + (plat.instagram.views||0) + (plat.facebook.views||0) + (plat.linkedin.views||0);
    const n = {day:24,week:7,month:30,year:12}[period]||7;
    const base = totalViews/365*({day:1,week:7,month:30,year:30}[period]||7)/n;
    return {
      labels: this.getFollowersChart(period).labels,
      reach:       MockData.genSeries(n, base*0.7,  base*0.1, base*0.003),
      impressions: MockData.genSeries(n, base*1.15, base*0.15, base*0.005),
    };
  },

  getTopPosts() {
    const plat = this.getPlatforms();
    const all  = [];
    ['tiktok','instagram','facebook','linkedin'].forEach(key => {
      const p = plat[key];
      if (p.rawPosts && p.rawPosts.length) {
        all.push(...p.rawPosts.map(post => ({ ...post, emoji: {tiktok:'🎵',instagram:'📸',facebook:'👍',linkedin:'💼'}[key] })));
      }
    });
    if (all.length === 0) return MockData.genPosts();
    return all.sort((a,b) => (b.likes||0) - (a.likes||0)).slice(0,5);
  },

  getHeatmap() {
    const rows = [];
    for (let d=0;d<7;d++) {
      const row=[];
      for (let h=0;h<24;h++) {
        let base=10;
        if ((h>=7&&h<=9)||(h>=12&&h<=13)||(h>=19&&h<=22)) base=60;
        else if ((h>=10&&h<=11)||(h>=17&&h<=18)) base=35;
        row.push(Math.floor(Math.random()*(base+20-Math.max(5,base-10))+Math.max(5,base-10)));
      }
      rows.push(row);
    }
    return rows;
  },

  getTimeline() {
    const plat = this.getPlatforms();
    const items = [];
    if (plat.tiktok.followers > 10000) items.push({ type:'record', icon:'🏆', event:`${this.fmt(plat.tiktok.followers)} abonnés TikTok`, time:'Mis à jour ' + (Cache.age('tiktok')||'récemment') });
    items.push({ type:'milestone', icon:'🎯', event:`Total abonnés : ${this.fmt((plat.tiktok.followers||0)+(plat.instagram.followers||0)+(plat.facebook.followers||0)+(plat.linkedin.followers||0))}`, time:'Toutes plateformes' });
    items.push({ type:'post', icon:'📤', event:'Données récupérées via Apify', time:new Date().toLocaleDateString('fr-FR') });
    if (plat.instagram.engagement < 3) items.push({ type:'drop', icon:'📉', event:'Engagement Instagram en baisse', time:'Cette semaine' });
    return items;
  },

  getHistory() {
    const plat = this.getPlatforms();
    const all  = [];
    ['tiktok','instagram','facebook','linkedin'].forEach(key => {
      const p = plat[key];
      if (p.rawPosts && p.rawPosts.length) {
        p.rawPosts.forEach((post, i) => all.push({ id: all.length+1, ...post, reach: Math.round((post.views||0)*0.7) }));
      }
    });
    if (all.length < 5) return MockData.genHistory();
    return all.sort((a,b) => (b.date||'').localeCompare(a.date||''));
  },

  getGoals() {
    const plat = this.getPlatforms();
    return [
      { id:1, title:'20k abonnés TikTok',   platform:'tiktok',    current:plat.tiktok.followers,    target:20000, due:'2025-09-30', color:'#FF0050' },
      { id:2, title:'10k abonnés Instagram', platform:'instagram', current:plat.instagram.followers, target:10000, due:'2025-08-31', color:'#E1306C' },
      { id:3, title:'50k abonnés au total',  platform:'global',    current:(plat.tiktok.followers||0)+(plat.instagram.followers||0)+(plat.facebook.followers||0)+(plat.linkedin.followers||0), target:50000, due:'2025-12-31', color:'#6366F1' },
      { id:4, title:'Taux engagement > 5%',  platform:'global',    current:parseFloat(((plat.tiktok.engagement+plat.instagram.engagement+plat.facebook.engagement+plat.linkedin.engagement)/4).toFixed(1)), target:5.0, due:'2025-10-01', color:'#22D3EE' },
      { id:5, title:'500 publications',       platform:'global',    current:(plat.tiktok.posts||0)+(plat.instagram.posts||0)+(plat.facebook.posts||0)+(plat.linkedin.posts||0), target:500, due:'2025-07-31', color:'#10B981' },
      { id:6, title:'3k abonnés LinkedIn',   platform:'linkedin',  current:plat.linkedin.followers, target:3000, due:'2025-11-30', color:'#0077B5' },
    ];
  },

  getAlerts() {
    const plat = this.getPlatforms();
    const alerts = [];
    let id = 1;
    if (plat.tiktok.followers > 15000) alerts.push({ id:id++, type:'record', icon:'🏆', title:`Record TikTok — ${this.fmt(plat.tiktok.followers)} abonnés !`, desc:'Continuez sur cette lancée.', time:'Données actuelles', read:false });
    if (plat.instagram.engagement < 3.0) alerts.push({ id:id++, type:'warning', icon:'📉', title:'Engagement Instagram faible', desc:`Taux actuel : ${plat.instagram.engagement}% — en dessous de la moyenne.`, time:'Données actuelles', read:false });
    if (!ApifyConfig.token) alerts.push({ id:id++, type:'info', icon:'⚙️', title:'Apify non configuré', desc:'Configurez votre token Apify dans Paramètres pour obtenir les vraies données.', time:'Maintenant', read:false });
    alerts.push({ id:id++, type:'info', icon:'🎯', title:'Objectif 50k global', desc:`Progression : ${this.fmt((plat.tiktok.followers||0)+(plat.instagram.followers||0)+(plat.facebook.followers||0)+(plat.linkedin.followers||0))} / 50 000`, time:'Données actuelles', read:true });
    return alerts;
  },

  getCalendarEvents(year, month) {
    const plat = this.getPlatforms();
    const allPosts = [];
    ['tiktok','instagram','facebook','linkedin'].forEach(key => {
      const p = plat[key];
      if (p.rawPosts) p.rawPosts.forEach(post => { if (post.date) allPosts.push({ date:post.date, platform:key, title:post.title }); });
    });
    if (allPosts.length === 0) return MockData.genCalEvents(year, month);
    return allPosts.filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  },

  getCompareChart() {
    return this.getFollowersChart('year');
  },

  getDailyViews(n=30) {
    const plat = this.getPlatforms();
    const totalViews = (plat.tiktok.views||0) + (plat.instagram.views||0) + (plat.facebook.views||0) + (plat.linkedin.views||0);
    const base = Math.round(totalViews / 365);
    const labels = Array.from({length:n},(_,i)=>{const d=new Date();d.setDate(d.getDate()-n+1+i);return`${d.getDate()}/${d.getMonth()+1}`;});
    return { labels, data: MockData.genSeries(n, base*0.8, base*0.15, base*0.003) };
  },

  getMonthlyData() {
    return { labels:['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'], followers: MockData.genSeries(12,18000,1000,150), engagement: MockData.genSeries(12,3.4,0.3,0.05) };
  },

  getAnnualGrowth() {
    return { labels:['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'], data: MockData.genSeries(12,8,4,0.5) };
  },

  getLikesComments(n=30) {
    const plat = this.getPlatforms();
    const baseLikes = Math.round(((plat.tiktok.likes||0)+(plat.instagram.likes||0)+(plat.facebook.likes||0)+(plat.linkedin.likes||0))/365);
    const labels = Array.from({length:n},(_,i)=>{const d=new Date();d.setDate(d.getDate()-n+1+i);return`${d.getDate()}/${d.getMonth()+1}`;});
    return { labels, likes: MockData.genSeries(n, baseLikes*0.8, baseLikes*0.15, baseLikes*0.003), comments: MockData.genSeries(n, baseLikes*0.08, baseLikes*0.02, 0.5) };
  },

  // Cache info
  getCacheInfo() {
    return {
      tiktok:    { age: Cache.age('tiktok'),    hasData: !!Cache.get('tiktok') },
      instagram: { age: Cache.age('instagram'), hasData: !!Cache.get('instagram') },
      facebook:  { age: Cache.age('facebook'),  hasData: !!Cache.get('facebook') },
      linkedin:  { age: Cache.age('linkedin'),  hasData: !!Cache.get('linkedin') },
    };
  },

  setToken(token) {
    ApifyConfig.token = token;
    localStorage.setItem('apify_token', token);
  },

  clearCache() { Cache.clear(); },

  fmt(n) {
    if (n >= 1_000_000) return (n/1_000_000).toFixed(1)+'M';
    if (n >= 1_000)     return (n/1_000).toFixed(1)+'k';
    return String(Math.round(n)||0);
  },

  PLATFORMS: {
    tiktok:    { color:'#FF0050' },
    instagram: { color:'#E1306C' },
    facebook:  { color:'#1877F2' },
    linkedin:  { color:'#0077B5' },
  },
};

// ── MockData extras ───────────────────────────────────────────
MockData.genPosts = () => [
  { platform:'tiktok',    title:'JFT du jour — Lâcher prise',           likes:8240,  views:124000, comments:412, shares:720,  engagement:5.8, date:'2025-06-21', emoji:'🎵' },
  { platform:'instagram', title:'Témoignage : 1 an de rétablissement',  likes:5610,  views:42000,  comments:287, shares:180,  engagement:6.2, date:'2025-06-18', emoji:'📸' },
  { platform:'linkedin',  title:'AFDER — Qui sommes-nous ?',             likes:1840,  views:18400,  comments:143, shares:94,   engagement:7.1, date:'2025-06-15', emoji:'💼' },
  { platform:'tiktok',    title:'JFT du 14 juin — Courage',              likes:6920,  views:98000,  comments:334, shares:640,  engagement:5.2, date:'2025-06-14', emoji:'🎵' },
  { platform:'facebook',  title:'Soutien entre pairs #reco',             likes:2140,  views:14200,  comments:98,  shares:190,  engagement:3.8, date:'2025-06-10', emoji:'👍' },
];

MockData.genHistory = () => {
  const titles = ['JFT du jour — Lâcher prise','Témoignage','Soutien entre pairs','AFDER — Qui sommes-nous','JFT — Courage','Réunion virtuelle','La sobriété au quotidien','JFT — Gratitude','Message d\'espoir','Les 12 étapes','JFT — Acceptation'];
  const platforms = ['tiktok','instagram','facebook','linkedin'];
  return Array.from({length:60},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-i);
    const plat=platforms[i%4];
    const views=Math.floor(Math.random()*180000+800);
    const likes=Math.floor(Math.random()*views*0.1+50);
    return { id:i+1, date:d.toISOString().split('T')[0], platform:plat, title:titles[i%titles.length], views, likes, comments:Math.floor(likes*0.12), shares:Math.floor(likes*0.18), engagement:parseFloat((Math.random()*6+1).toFixed(1)), reach:Math.floor(views*0.7) };
  });
};

MockData.genCalEvents = (year, month) => {
  const n = new Date(year,month+1,0).getDate();
  const events=[]; const platforms=['tiktok','instagram','facebook','linkedin'];
  const titles=['JFT du jour','Carrousel AFDER','Témoignage','Message d\'espoir'];
  for(let d=1;d<=n;d++) {
    if(Math.random()>0.55) continue;
    const date=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    events.push({ date, platform:platforms[Math.floor(Math.random()*4)], title:titles[Math.floor(Math.random()*4)] });
  }
  return events;
};
