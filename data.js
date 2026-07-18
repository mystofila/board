/**
 * data.js — Lit history.json depuis GitHub Pages
 */

const ApifyConfig = {
  token: localStorage.getItem('apify_token') || '',
};

const MockAPI = {
  _raw:       [],
  _latest:    {},
  _callbacks: [],
  _loading:   false,

  async loadAll() {
    if (this._loading) return;
    this._loading = true;
    this._notify('loading', null);

    try {
      const res = await fetch('https://mystofila.github.io/board/history.json?v=' + Date.now());
      if (!res.ok) throw new Error('history.json introuvable (' + res.status + ')');
      const data = await res.json();

      this._raw = Array.isArray(data) ? data : [];

      // Dernière entrée par plateforme (peu importe si followers = 0)
      const KEYS = ['tiktok', 'instagram', 'facebook_fr', 'facebook_es'];
      this._latest = {};
      KEYS.forEach(key => {
        const entries = this._raw
          .filter(e => e.platform === key)
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        if (entries.length) this._latest[key] = entries[0];
      });

      this._notify('done', this._latest);
    } catch (err) {
      console.error('[data.js]', err.message);
      this._notify('error', err.message);
    }

    this._loading = false;
  },

  on(fn)                { this._callbacks.push(fn); },
  _notify(type, payload){ this._callbacks.forEach(fn => { try { fn(type, payload); } catch {} }); },

  getPlatforms() { return this._latest; },

  getHistory() {
    return [...this._raw].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  },

  getTopPosts() { return []; },

  getAlerts() {
    const alerts = [];
    let id = 1;
    const p = this._latest;

    if (!Object.keys(p).length) {
      alerts.push({ id: id++, type: 'info', icon: '⚙️',
        title: 'Aucune donnée chargée',
        desc: 'Vérifiez que history.json existe dans le repo et que GitHub Pages est actif.',
        time: '', read: false });
    }
    if (p.tiktok && p.tiktok.followers > 500) {
      alerts.push({ id: id++, type: 'record', icon: '🏆',
        title: `TikTok — ${this.fmt(p.tiktok.followers)} abonnés`,
        desc: '', time: p.tiktok.date || '', read: false });
    }
    return alerts;
  },

  setToken(token) { ApifyConfig.token = token; localStorage.setItem('apify_token', token); },
  clearCache()    {},

  fmt(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
    return String(Math.round(n) || 0);
  },

  COLORS: {
    instagram:   '#E1306C',
    tiktok:      '#FF0050',
    facebook_fr: '#1877F2',
    facebook_es: '#0A5DC2',
  },
  ICONS: {
    instagram:   '📸',
    tiktok:      '🎵',
    facebook_fr: '🇫🇷',
    facebook_es: '🇪🇸',
  },
  LABELS: {
    instagram:   'Instagram',
    tiktok:      'TikTok',
    facebook_fr: 'Facebook France',
    facebook_es: 'Facebook Espagne',
  },
};
