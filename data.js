/**
 * data.js — MockAPI
 * ============================================================
 * Toutes les données sont simulées mais structurées comme si
 * elles provenaient d'API réelles (TikTok, Instagram, etc.)
 *
 * Pour connecter une vraie API, remplacez MockAPI.fetch() par
 * un appel fetch() vers votre backend ou endpoint.
 * ============================================================
 */

const MockAPI = (() => {

  // ── Helpers ────────────────────────────────────────────────
  const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const randF = (min, max, dec=1) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));

  const fmt = n => {
    if (n >= 1_000_000) return (n/1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n/1_000).toFixed(1) + 'k';
    return n.toString();
  };

  const DAYS   = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

  function genSeries(length, base, variance, trend=1) {
    const out = [];
    let val = base;
    for (let i = 0; i < length; i++) {
      val += (Math.random() - 0.45) * variance + trend;
      out.push(Math.max(0, Math.round(val)));
    }
    return out;
  }

  function last7Labels() {
    const labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      labels.push(DAYS[d.getDay()]);
    }
    return labels;
  }

  function last30Labels() {
    const labels = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      labels.push(`${d.getDate()}/${d.getMonth()+1}`);
    }
    return labels;
  }

  // ── Platform configs ───────────────────────────────────────
  const PLATFORMS = {
    tiktok: {
      name: 'TikTok', emoji: '🎵', color: '#FF0050',
      followers: 18400, followersGrowth: 3.2,
      views: 284000, likes: 41200, comments: 3800, shares: 7200,
      engagement: 4.8, handle: '@afder.recovery',
      posts: 127, avgViews: 2236,
    },
    instagram: {
      name: 'Instagram', emoji: '📸', color: '#E1306C',
      followers: 9250, followersGrowth: 1.8,
      views: 142000, likes: 18600, comments: 1240, shares: 2800,
      engagement: 3.4, handle: '@afder.recovery',
      posts: 89, avgViews: 1596,
    },
    facebook: {
      name: 'Facebook', emoji: '👍', color: '#1877F2',
      followers: 6120, followersGrowth: 0.6,
      views: 78000, likes: 7400, comments: 890, shares: 1900,
      engagement: 2.1, handle: 'AFDER.Recovery',
      posts: 204, avgViews: 382,
    },
    linkedin: {
      name: 'LinkedIn', emoji: '💼', color: '#0077B5',
      followers: 2380, followersGrowth: 2.9,
      views: 34000, likes: 3200, comments: 480, shares: 940,
      engagement: 5.6, handle: 'AFDER',
      posts: 41, avgViews: 829,
    },
  };

  // ── Global KPIs ────────────────────────────────────────────
  const STATS = {
    day: {
      followers: { value: 36150, change: +2.4, sparkData: genSeries(12, 35000, 400, 12) },
      views:     { value: 12400, change: +8.1, sparkData: genSeries(12, 11000, 800, 40) },
      likes:     { value: 1820,  change: +5.3, sparkData: genSeries(12, 1600, 150, 8) },
      engagement:{ value: 4.2,   change: -0.3, sparkData: genSeries(12, 4.0, 0.3, 0) },
      growth:    { value: 142,   change: +12,  sparkData: genSeries(12, 100, 30, 2) },
    },
    week: {
      followers: { value: 36150, change: +1.8, sparkData: genSeries(7, 35500, 300, 20) },
      views:     { value: 87300, change: +12.4, sparkData: genSeries(7, 78000, 4000, 200) },
      likes:     { value: 12740, change: +9.2, sparkData: genSeries(7, 11000, 800, 40) },
      engagement:{ value: 4.1,   change: +0.5, sparkData: genSeries(7, 3.8, 0.2, 0) },
      growth:    { value: 980,   change: +18,  sparkData: genSeries(7, 800, 100, 20) },
    },
    month: {
      followers: { value: 36150, change: +8.6, sparkData: genSeries(30, 33000, 200, 12) },
      views:     { value: 345000, change: +22.1, sparkData: genSeries(30, 310000, 8000, 500) },
      likes:     { value: 51200, change: +18.7, sparkData: genSeries(30, 44000, 2000, 200) },
      engagement:{ value: 4.3,   change: +0.8, sparkData: genSeries(30, 3.7, 0.2, 0) },
      growth:    { value: 3840,  change: +24,  sparkData: genSeries(30, 3200, 200, 20) },
    },
    year: {
      followers: { value: 36150, change: +94.2, sparkData: genSeries(12, 18000, 1000, 150) },
      views:     { value: 4120000, change: +187, sparkData: genSeries(12, 2800000, 100000, 12000) },
      likes:     { value: 612000, change: +143, sparkData: genSeries(12, 480000, 20000, 1200) },
      engagement:{ value: 4.3,   change: +1.2, sparkData: genSeries(12, 3.4, 0.3, 0) },
      growth:    { value: 18400, change: +94,  sparkData: genSeries(12, 8000, 1200, 600) },
    },
  };

  // ── Followers chart data ────────────────────────────────────
  function getFollowersChart(period) {
    const map = {
      day:   { labels: Array.from({length:24}, (_,i)=>`${i}h`), n:24 },
      week:  { labels: last7Labels(), n:7 },
      month: { labels: last30Labels(), n:30 },
      year:  { labels: MONTHS, n:12 },
    };
    const {labels, n} = map[period] || map.week;
    return {
      labels,
      datasets: {
        tiktok:    genSeries(n, 17000, period==='year'?1200:200, period==='year'?120:8),
        instagram: genSeries(n, 8500,  period==='year'?800:120,  period==='year'?60:4),
        facebook:  genSeries(n, 5800,  period==='year'?400:60,   period==='year'?30:2),
        linkedin:  genSeries(n, 2000,  period==='year'?300:40,   period==='year'?25:2),
      }
    };
  }

  // ── Engagement chart data ───────────────────────────────────
  function getEngagementChart(period) {
    const n = {day:24, week:7, month:30, year:12}[period] || 7;
    const labels = period==='week' ? last7Labels()
      : period==='month' ? last30Labels()
      : period==='year' ? MONTHS
      : Array.from({length:n}, (_,i)=>`${i}h`);
    return {
      labels,
      tiktok:    genSeries(n, 4.5, 0.5),
      instagram: genSeries(n, 3.2, 0.4),
      facebook:  genSeries(n, 2.0, 0.3),
      linkedin:  genSeries(n, 5.2, 0.6),
    };
  }

  // ── Reach chart data ───────────────────────────────────────
  function getReachChart(period) {
    const n = {day:24, week:7, month:30, year:12}[period] || 7;
    const labels = period==='week' ? last7Labels()
      : period==='month' ? last30Labels()
      : period==='year' ? MONTHS
      : Array.from({length:n}, (_,i)=>`${i}h`);
    return {
      labels,
      reach:       genSeries(n, 28000, 4000, 200),
      impressions: genSeries(n, 45000, 6000, 300),
    };
  }

  // ── Top posts ───────────────────────────────────────────────
  const TOP_POSTS = [
    { id:1, title:'JFT du 21 juin — Lâcher prise', platform:'tiktok', likes:8240, views:124000, comments:412, engagement:5.8, date:'2025-06-21', emoji:'🎵' },
    { id:2, title:'Témoignage : 1 an de rétablissement', platform:'instagram', likes:5610, views:42000, comments:287, engagement:6.2, date:'2025-06-18', emoji:'📸' },
    { id:3, title:'AFDER — Qui sommes-nous ?', platform:'linkedin', likes:1840, views:18400, comments:143, engagement:7.1, date:'2025-06-15', emoji:'💼' },
    { id:4, title:'JFT du 14 juin — Courage', platform:'tiktok', likes:6920, views:98000, comments:334, engagement:5.2, date:'2025-06-14', emoji:'🎵' },
    { id:5, title:'Soutien entre pairs #reco', platform:'facebook', likes:2140, views:14200, comments:98, engagement:3.8, date:'2025-06-10', emoji:'👍' },
  ];

  // ── Heatmap data ────────────────────────────────────────────
  function getHeatmap() {
    const data = [];
    for (let day = 0; day < 7; day++) {
      const row = [];
      for (let h = 0; h < 24; h++) {
        // Peak hours: 7-9, 12-13, 19-22
        let base = 10;
        if ((h>=7&&h<=9)||(h>=12&&h<=13)||(h>=19&&h<=22)) base = 60;
        else if ((h>=10&&h<=11)||(h>=17&&h<=18)) base = 35;
        row.push(rand(base-5, base+30));
      }
      data.push(row);
    }
    return data;
  }

  // ── Timeline events ─────────────────────────────────────────
  const TIMELINE = [
    { type:'record',    icon:'🏆', event:'Record — 18 400 abonnés TikTok atteint',      time:'Il y a 2 heures' },
    { type:'milestone', icon:'🎯', event:'Objectif 35k global dépassé',                  time:'Il y a 1 jour' },
    { type:'post',      icon:'📤', event:'Publication JFT du 26 juin postée (3 canaux)', time:'Il y a 2 jours' },
    { type:'drop',      icon:'📉', event:'Engagement Instagram en baisse (-0.8%)',        time:'Il y a 3 jours' },
    { type:'milestone', icon:'🎊', event:'100e publication TikTok',                       time:'Il y a 5 jours' },
    { type:'post',      icon:'📤', event:'Carrousel "1 an de rétablissement" publié',     time:'Il y a 8 jours' },
  ];

  // ── History (full log) ──────────────────────────────────────
  function genHistory() {
    const titles = [
      'JFT du jour — Lâcher prise','Témoignage : 1 an de rétablissement',
      'Soutien entre pairs','AFDER — Qui sommes-nous ?','JFT — Courage',
      'Réunion virtuelle AFDER','La sobriété au quotidien','JFT — Gratitude',
      'Message d\'espoir','Les 12 étapes expliquées','JFT — Acceptation',
      'Partage de Mona','Vivre sans substances','JFT — Paix intérieure',
      'Rejoindre AFDER','Histoires de rétablissement','JFT — Confiance',
    ];
    const platforms = ['tiktok','instagram','facebook','linkedin'];
    const rows = [];
    for (let i = 0; i < 80; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const plat = platforms[i % platforms.length];
      const views = rand(800, 180000);
      const likes = rand(50, Math.floor(views * 0.1));
      rows.push({
        id:       i+1,
        date:     d.toISOString().split('T')[0],
        platform: plat,
        title:    titles[i % titles.length],
        views:    views,
        likes:    likes,
        comments: rand(10, Math.floor(likes * 0.15)),
        shares:   rand(5, Math.floor(likes * 0.2)),
        engagement: randF(1.2, 7.8),
        reach:    rand(500, Math.floor(views * 0.8)),
      });
    }
    return rows;
  }

  // ── Goals ──────────────────────────────────────────────────
  const GOALS = [
    { id:1, title:'20k abonnés TikTok', platform:'tiktok', current:18400, target:20000, due:'2025-09-30', color:'#FF0050' },
    { id:2, title:'10k abonnés Instagram', platform:'instagram', current:9250, target:10000, due:'2025-08-31', color:'#E1306C' },
    { id:3, title:'50k abonnés au total', platform:'global', current:36150, target:50000, due:'2025-12-31', color:'#6366F1' },
    { id:4, title:'Taux engagement > 5%', platform:'global', current:4.3, target:5.0, due:'2025-10-01', color:'#22D3EE' },
    { id:5, title:'500 publications totales', platform:'global', current:461, target:500, due:'2025-07-31', color:'#10B981' },
    { id:6, title:'3k abonnés LinkedIn', platform:'linkedin', current:2380, target:3000, due:'2025-11-30', color:'#0077B5' },
  ];

  // ── Alerts ─────────────────────────────────────────────────
  const ALERTS = [
    { id:1, type:'record', icon:'🏆', title:'Nouveau record TikTok !', desc:'18 400 abonnés — votre meilleur score depuis le lancement.', time:'Il y a 2h', read:false },
    { id:2, type:'warning', icon:'📉', title:'Baisse d\'engagement Instagram', desc:'Taux d\'engagement passé de 4.2% à 3.4% cette semaine.', time:'Il y a 1j', read:false },
    { id:3, type:'reminder', icon:'📅', title:'Aucune publication sur LinkedIn', desc:'Aucun post depuis 4 jours. Publiez pour maintenir la visibilité.', time:'Il y a 2j', read:false },
    { id:4, type:'info', icon:'🎯', title:'Objectif 50k total à 72%', desc:'Il vous reste 13 850 abonnés pour atteindre votre objectif annuel.', time:'Il y a 3j', read:true },
    { id:5, type:'record', icon:'🎊', title:'100e publication TikTok', desc:'Vous avez atteint 100 publications sur TikTok — félicitations !', time:'Il y a 5j', read:true },
  ];

  // ── Calendar events ─────────────────────────────────────────
  function getCalendarEvents(year, month) {
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const events = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const n = rand(0, 3);
      if (n === 0) continue;
      const date = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const platforms = ['tiktok','instagram','facebook','linkedin'];
      for (let i = 0; i < n; i++) {
        events.push({
          date, platform: platforms[(d+i)%4],
          title: ['JFT du jour','Carrousel AFDER','Témoignage','Réunion virtuelle','Message d\'espoir'][rand(0,4)],
        });
      }
    }
    return events;
  }

  // ── Compare chart ───────────────────────────────────────────
  function getCompareChart() {
    return {
      labels: MONTHS,
      tiktok:    genSeries(12, 12000, 800, 500),
      instagram: genSeries(12, 6000,  500, 250),
      facebook:  genSeries(12, 4500,  300, 140),
      linkedin:  genSeries(12, 1200,  200, 100),
    };
  }

  // ── Public API ─────────────────────────────────────────────
  return {
    getStats:         (period) => STATS[period] || STATS.week,
    getPlatforms:     () => PLATFORMS,
    getFollowersChart:(period) => getFollowersChart(period),
    getEngagementChart:(period) => getEngagementChart(period),
    getReachChart:    (period) => getReachChart(period),
    getTopPosts:      () => TOP_POSTS,
    getHeatmap:       () => getHeatmap(),
    getTimeline:      () => TIMELINE,
    getHistory:       () => genHistory(),
    getGoals:         () => [...GOALS],
    getAlerts:        () => [...ALERTS],
    getCalendarEvents,
    getCompareChart:  () => getCompareChart(),
    getDailyViews:    (n=30) => ({ labels: last30Labels(), data: genSeries(n, 8000, 2000, 100) }),
    getMonthlyData:   () => ({ labels: MONTHS, followers: genSeries(12,18000,800,150), engagement: genSeries(12,3.4,0.3,0) }),
    getAnnualGrowth:  () => ({ labels: MONTHS, data: genSeries(12, 10, 5, 0.5) }),
    getLikesComments: (n=30) => ({ labels: last30Labels(), likes: genSeries(n,800,200,10), comments: genSeries(n,80,30,1) }),
    fmt, PLATFORMS,
  };
})();
