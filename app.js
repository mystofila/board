/**
 * app.js — Logique principale AFDER Analytics
 */

const AppState = {
  network:  'all',   // filtre réseau actif
  data:     {},      // données chargées
  history:  [],
  filtered: [],
  alerts:   [],
  page:     1,
  pageSize: 20,
};

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Afficher token masqué si déjà enregistré
  const saved = localStorage.getItem('apify_token');
  if (saved) {
    const el = document.getElementById('apify-token-input');
    if (el) el.placeholder = 'Token enregistré (masqué)';
    document.getElementById('token-status').textContent = '✓ Token configuré';
  }

  // Écouter les événements de chargement
  MockAPI.on((type, payload) => {
    if (type === 'loading') setStatus('loading', 'Connexion à Apify…');
    else if (type === 'partial') {
      const icons = { tiktok:'🎵', instagram:'📸', facebook:'👍', linkedin:'💼' };
      setStatus('loading', `${icons[payload.platform]} ${payload.platform} chargé${payload.cached?' (cache)':''}`);
      render();
    }
    else if (type === 'done') {
      const hasReal = Object.values(payload).some(p => p.lastUpdated && !p.note?.includes('simulé'));
      setStatus(hasReal ? 'ok' : 'error',
        hasReal ? 'Données chargées ✓' : 'Pas de token — données vides');
      AppState.data    = MockAPI.getPlatforms();
      AppState.alerts  = MockAPI.getAlerts();
      AppState.history = MockAPI.getHistory();
      AppState.filtered= [...AppState.history];
      updateAlertBadge();
      render();
    }
    else if (type === 'error') setStatus('error', payload);
  });

  MockAPI.loadAll();
});

// ── Navigation ───────────────────────────────────────────────
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  if (window.innerWidth < 800) closeSidebar();
  render(page);
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ── Filtre réseau ────────────────────────────────────────────
function setNetwork(net, btn) {
  AppState.network = net;
  document.querySelectorAll('.net-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  render();
}

// ── Render principal ─────────────────────────────────────────
function render(page) {
  const active = page || document.querySelector('.page.active')?.id?.replace('page-','') || 'overview';
  switch(active) {
    case 'overview': renderOverview(); break;
    case 'compare':  renderCompare();  break;
    case 'posts':    renderPosts();    break;
    case 'alerts':   renderAlerts();   break;
    case 'history':  renderHistory();  break;
  }
}

// ── OVERVIEW ─────────────────────────────────────────────────
function renderOverview() {
  const plats  = getFilteredPlatforms();
  renderStatCards(plats);
  buildFollowersChart(plats);
  buildDonutChart(plats);
  buildEngagementChart(plats);
  buildReachChart(plats);
}

function getFilteredPlatforms() {
  const all = MockAPI.getPlatforms();
  if (AppState.network === 'all') return all;
  return { [AppState.network]: all[AppState.network] };
}

function renderStatCards(plats) {
  const grid = document.getElementById('stat-cards');
  if (!grid) return;

  const entries = Object.entries(plats);
  if (!entries.length || entries.every(([,p]) => !p || !p.followers)) {
    grid.innerHTML = emptyState('Aucune donnée', 'Configurez votre token Apify dans Paramètres pour récupérer vos vraies statistiques.');
    return;
  }

  const COLOR = { tiktok:'#FF0050', instagram:'#E1306C', facebook:'#1877F2', linkedin:'#0077B5' };
  const ICON  = { tiktok:'🎵', instagram:'📸', facebook:'👍', linkedin:'💼' };

  // Si un seul réseau : cartes détaillées
  if (entries.length === 1) {
    const [key, p] = entries[0];
    const color = COLOR[key];
    grid.innerHTML = [
      card('Abonnés',   fmt(p.followers),  key, color, p.handle),
      card('Vues',      fmt(p.views||0),   key, color),
      card('Likes',     fmt(p.likes||0),   key, color),
      card('Commentaires', fmt(p.comments||0), key, color),
      card('Engagement', (p.engagement||0)+'%', key, color),
      card('Publications', fmt(p.posts||0), key, color),
    ].join('');
    return;
  }

  // Multi-réseau : une carte par plateforme
  grid.innerHTML = entries.map(([key, p]) => {
    if (!p) return '';
    const color = COLOR[key];
    return `<div class="stat-card" style="--card-color:${color}">
      <div class="stat-label">${ICON[key]} ${key.charAt(0).toUpperCase()+key.slice(1)}</div>
      <div class="stat-value">${fmt(p.followers||0)}</div>
      <div class="stat-sub">
        ${p.engagement ? `${p.engagement}% eng · ` : ''}${fmt(p.likes||0)} likes
      </div>
      ${p.handle ? `<div class="stat-platform platform-badge ${key}">${p.handle}</div>` : ''}
    </div>`;
  }).join('');

  function card(label, value, key, color, sub='') {
    return `<div class="stat-card" style="--card-color:${color}">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
      ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
    </div>`;
  }
}

// ── COMPARE ──────────────────────────────────────────────────
function renderCompare() {
  const grid  = document.getElementById('platform-cards');
  if (!grid) return;
  const plats = MockAPI.getPlatforms();
  const COLOR = { tiktok:'#FF0050', instagram:'#E1306C', facebook:'#1877F2', linkedin:'#0077B5' };
  const ICON  = { tiktok:'🎵', instagram:'📸', facebook:'👍', linkedin:'💼' };

  const hasData = Object.values(plats).some(p => p && p.followers);
  if (!hasData) {
    grid.innerHTML = emptyState('Aucune donnée', 'Configurez Apify dans Paramètres.');
    return;
  }

  grid.innerHTML = Object.entries(plats).map(([key, p]) => {
    if (!p || !p.followers) return `<div class="platform-card">
      <div class="platform-card-header">
        <div class="platform-logo" style="background:${hexA(COLOR[key],0.1)}">${ICON[key]}</div>
        <div><div class="platform-name">${key}</div><div class="platform-handle">Pas de données</div></div>
      </div>
    </div>`;

    const rows = [
      ['Abonnés',      fmt(p.followers)],
      ['Vues',         fmt(p.views||0)],
      ['Likes',        fmt(p.likes||0)],
      ['Commentaires', fmt(p.comments||0)],
      ['Engagement',   (p.engagement||0)+'%'],
      ['Publications', fmt(p.posts||0)],
    ];
    return `<div class="platform-card">
      <div class="platform-card-header">
        <div class="platform-logo" style="background:${hexA(COLOR[key],0.12)}">${ICON[key]}</div>
        <div>
          <div class="platform-name" style="color:${COLOR[key]}">${p.name||key}</div>
          <div class="platform-handle">${p.handle||''}</div>
        </div>
      </div>
      ${rows.map(([l,v])=>`<div class="platform-stat"><span style="color:var(--text-muted)">${l}</span><span class="platform-stat-val">${v}</span></div>`).join('')}
      ${p.lastUpdated ? `<div style="font-size:10px;color:var(--text-muted);margin-top:10px">Mis à jour : ${new Date(p.lastUpdated).toLocaleDateString('fr-FR')}</div>` : ''}
      ${p.note ? `<div style="font-size:10px;color:var(--orange);margin-top:4px">${p.note}</div>` : ''}
    </div>`;
  }).join('');
}

// ── POSTS ────────────────────────────────────────────────────
function renderPosts() {
  const el = document.getElementById('posts-content');
  if (!el) return;
  const posts = MockAPI.getTopPosts();

  if (!posts || !posts.length) {
    el.innerHTML = emptyState('Aucune publication', 'Les publications apparaîtront ici une fois Apify configuré et les données récupérées.');
    return;
  }

  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr>
      <th>Titre</th><th>Plateforme</th><th>Vues</th><th>Likes</th><th>Commentaires</th><th>Engagement</th><th>Date</th>
    </tr></thead>
    <tbody>${posts.map(p=>`<tr>
      <td style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.title||'—'}</td>
      <td><span class="platform-badge ${p.platform}">${p.platform}</span></td>
      <td class="td-mono">${fmt(p.views||0)}</td>
      <td class="td-mono">${fmt(p.likes||0)}</td>
      <td class="td-mono">${fmt(p.comments||0)}</td>
      <td class="td-mono">${(p.engagement||0).toFixed(1)}%</td>
      <td class="td-muted">${p.date||'—'}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

// ── ALERTS ───────────────────────────────────────────────────
function renderAlerts() {
  const list = document.getElementById('alerts-list');
  if (!list) return;
  const alerts = AppState.alerts;

  if (!alerts.length) {
    list.innerHTML = emptyState('Aucune alerte', 'Tout va bien.');
    return;
  }

  list.innerHTML = alerts.map(a => `
    <div class="alert-item ${a.read?'read':''}" id="alert-${a.id}">
      <div class="alert-icon ${a.type}">${a.icon}</div>
      <div class="alert-body">
        <div class="alert-title">${a.title}</div>
        <div class="alert-desc">${a.desc}</div>
        <div class="alert-time">${a.time}</div>
        <div class="alert-actions">
          ${!a.read?`<button class="alert-btn" onclick="markRead(${a.id})">Lu</button>`:''}
          <button class="alert-btn" onclick="dismissAlert(${a.id})">Ignorer</button>
        </div>
      </div>
    </div>`).join('');
}

function markRead(id) {
  const a = AppState.alerts.find(a=>a.id===id);
  if (a) { a.read=true; renderAlerts(); updateAlertBadge(); }
}
function dismissAlert(id) {
  AppState.alerts = AppState.alerts.filter(a=>a.id!==id);
  renderAlerts(); updateAlertBadge();
}
function markAllRead() {
  AppState.alerts.forEach(a=>a.read=true);
  renderAlerts(); updateAlertBadge();
  showToast('✅ Tout marqué comme lu');
}
function updateAlertBadge() {
  const n = AppState.alerts.filter(a=>!a.read).length;
  const b = document.getElementById('alert-badge');
  if (b) { b.textContent=n; b.style.display=n?'':'none'; }
}

// ── HISTORY ──────────────────────────────────────────────────
function renderHistory() {
  const el = document.getElementById('history-content');
  if (!el) return;
  const data = AppState.filtered;

  if (!data.length) {
    el.innerHTML = emptyState('Aucun historique', 'L\'historique des publications apparaîtra ici après récupération via Apify.');
    return;
  }

  const slice = data.slice(0, AppState.page * AppState.pageSize);
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Date</th><th>Plateforme</th><th>Titre</th><th>Vues</th><th>Likes</th><th>Engagement</th></tr></thead>
    <tbody>${slice.map(r=>`<tr>
      <td class="td-muted">${r.date||'—'}</td>
      <td><span class="platform-badge ${r.platform}">${r.platform}</span></td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.title||'—'}</td>
      <td class="td-mono">${fmt(r.views||0)}</td>
      <td class="td-mono">${fmt(r.likes||0)}</td>
      <td class="td-mono">${(r.engagement||0).toFixed(1)}%</td>
    </tr>`).join('')}</tbody>
  </table></div>
  ${slice.length < data.length ? `<div style="text-align:center;margin-top:16px"><button class="btn-secondary" onclick="loadMore()">Charger plus (${data.length - slice.length} restants)</button></div>` : ''}`;
}

function loadMore() { AppState.page++; renderHistory(); }

function filterHistory() {
  const q = document.getElementById('history-search')?.value?.toLowerCase() || '';
  AppState.filtered = AppState.history.filter(r =>
    !q || (r.title||'').toLowerCase().includes(q) || r.platform.includes(q)
  );
  AppState.page = 1;
  renderHistory();
}

// ── SETTINGS ─────────────────────────────────────────────────
function saveApifyToken() {
  const val = document.getElementById('apify-token-input')?.value?.trim();
  if (!val) { showToast('⚠️ Token vide'); return; }
  MockAPI.setToken(val);
  document.getElementById('apify-token-input').value = '';
  document.getElementById('apify-token-input').placeholder = 'Token enregistré (masqué)';
  document.getElementById('token-status').textContent = '✓ Token configuré';
  showToast('✅ Token enregistré');
  setTimeout(() => refreshData(), 300);
}

async function refreshData() {
  if (!ApifyConfig.token) {
    showToast('⚙️ Configurez d\'abord le token dans Paramètres');
    navigateTo('settings');
    return;
  }
  MockAPI.clearCache();
  await MockAPI.loadAll(true);
}

function clearAllCache() {
  MockAPI.clearCache();
  showToast('🗑️ Cache vidé');
}

// ── EXPORT ───────────────────────────────────────────────────
function exportData(fmt_) {
  const data = AppState.filtered.length ? AppState.filtered : AppState.history;
  if (!data.length) { showToast('Aucune donnée à exporter'); return; }
  if (fmt_ === 'json') {
    download('afder_stats.json', JSON.stringify(data, null, 2), 'application/json');
  } else {
    const cols = ['date','platform','title','views','likes','comments','engagement'];
    const rows = [cols.join(','), ...data.map(r => cols.map(c=>`"${String(r[c]||'').replace(/"/g,'""')}"`).join(','))];
    download('afder_stats.csv', rows.join('\n'), 'text/csv');
  }
  showToast(`📥 Export téléchargé`);
}

function download(name, content, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], {type:mime}));
  a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}

// ── UTILS ────────────────────────────────────────────────────
function fmt(n) {
  if (n>=1_000_000) return (n/1_000_000).toFixed(1)+'M';
  if (n>=1_000)     return (n/1_000).toFixed(1)+'k';
  return String(Math.round(n)||0);
}

function hexA(hex, a) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function emptyState(title, desc) {
  return `<div class="empty-state">
    <div class="empty-state-icon">📭</div>
    <div class="empty-state-title">${title}</div>
    <div class="empty-state-desc">${desc}</div>
  </div>`;
}

function setStatus(type, text) {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  if (dot) dot.className = `status-dot ${type}`;
  if (txt) txt.textContent = text;
}

function showToast(msg, ms=3000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), ms);
}
