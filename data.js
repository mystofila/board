/**
 * data.js — Lit history.json du repo, pas Apify directement
 */

const ApifyConfig = {
  token: localStorage.getItem('apify_token') || '',
  handles: {
    tiktok:      'https://www.tiktok.com/@afder.recovery',
    instagram:   'afder.recovery',
    facebook_fr: 'https://www.facebook.com/afder.recovery',
    facebook_es: 'https://www.facebook.com/OldTimersRecovery/',
  },
};

// ── MockAPI ───────────────────────────────────────────────────
const MockAPI = {
  _raw:      [],   // toutes les entrées de history.json
  _latest:   {},   // dernière entrée par plateforme
  _callbacks: [],
  _loading:   false,

  async loadAll(force = false) {
    if (this._loading) return;
    this._loading = true;
    this._notify('loading', null);

    try {
      // Fetch history.json depuis le même repo (chemin relatif)
      const res = await fetch('history.json?nocache=' + Date.now());
      if (!res.ok) throw new Error(`history.json introuvable (${res.status})`);
      const data = await res.json();

      this._raw = Array.isArray(data) ? data : [];

      // Extraire la dernière entrée par plateforme
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

  on(fn)               { this._callbacks.push(fn); },
  _notify(type, payload) { this._callbacks.forEach(fn => { try { fn(type, payload); } catch {} }); },

  getPlatforms() { return this._latest; },

  // Historique complet pour la page Historique
  getHistory() {
    return [...this._raw].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  },

  // Posts — history.json ne contient pas le détail des posts pour l'instant
  getTopPosts() { return []; },

  getAlerts() {
    const alerts = [];
    let id = 1;
    const p = this._latest;

    if (!Object.keys(p).length) {
      alerts.push({ id: id++, type: 'info', icon: '⚙️', title: 'history.json vide ou introuvable', desc: 'Lancez le workflow GitHub Actions pour récupérer les données.', time: '', read: false });
    }
    if (p.tiktok && p.tiktok.followers > 10000) {
      alerts.push({ id: id++, type: 'record', icon: '🏆', title: `TikTok — ${this.fmt(p.tiktok.followers)} abonnés`, desc: '', time: p.tiktok.date || '', read: false });
    }
    if (p.instagram && p.instagram.engagement < 3) {
      alerts.push({ id: id++, type: 'warning', icon: '📉', title: 'Engagement Instagram faible', desc: `Taux actuel : ${p.instagram.engagement}%`, time: p.instagram.date || '', read: false });
    }
    return alerts;
  },

  setToken(token) { ApifyConfig.token = token; localStorage.setItem('apify_token', token); },
  clearCache()    { /* pas de cache côté client, history.json est la source */ },

  fmt(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
    return String(Math.round(n) || 0);
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
