/**
 * app.js — AFDER Analytics
 */

const AppState = {
  
  network:  'all',
  history:  [],
  filtered: [],
  alerts:   [],
  page:     1,
  pageSize: 20,
};

const KEYS   = ['tiktok','instagram','facebook_fr','facebook_es'];

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('apify_token')) {
    const el = document.getElementById('apify-token-input');
    if (el) el.placeholder = 'Token enregistré (masqué)';
    document.getElementById('token-status').textContent = '✓ Token configuré';
  }

  MockAPI.on((type, payload) => {
    if (type === 'loading') {
      setStatus('loading', 'Connexion à Apify…');
    } else if (type === 'partial') {
      const label = MockAPI.LABELS[payload.platform] || payload.platform;
      if (payload.error) setStatus('error', `${label} — erreur`);
      else setStatus('loading', `${label} chargé${payload.cached?' (cache)':''}`);
      render();
    } else if (type === 'done') {
      const hasData = Object.values(MockAPI.getPlatforms()).some(p => p && p.followers);
      setStatus(hasData ? 'ok' : 'error',
        hasData ? 'Données chargées ✓' : 'Aucune donnée — configurez le token Apify');
      AppState.alerts  = MockAPI.getAlerts();
      AppState.history = MockAPI.getHistory();
      AppState.filtered= [...AppState.history];
      updateAlertBadge();
      render();
    }
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

// ── Render ───────────────────────────────────────────────────
function render(page) {
  const active = page || document.querySelector('.page.active')?.id?.replace('page-','') || 'overview';
  switch(active) {
    case 'overview': renderOverview(); break;
    case 'compare':  renderCompare();  break;
    case 'posts':    renderPosts();    break;
    case 'history':  renderHistory();  break;
    case 'alerts':   renderAlerts();   break;
  }
}

// ── OVERVIEW ─────────────────────────────────────────────────
function renderOverview() {
  const plats = getFiltered();
  renderStatCards(plats);
  buildFollowersChart(plats);
  buildDonutChart(plats);
  buildEngagementChart(plats);
  buildReachChart(plats);
}

function getFiltered() {
  const all = MockAPI.getPlatforms();
  if (AppState.network === 'all') return all;
  const p = all[AppState.network];
  return p ? { [AppState.network]: p } : {};
}

function renderStatCards(plats) {
  const grid = document.getElementById('stat-cards');
  if (!grid) return;
  const entries = Object.entries(plats).filter(([,p]) => p != null);

  if (!entries.length) {
    grid.innerHTML = emptyState('Aucune donnée', 'Configurez votre token Apify dans Paramètres.');
    return;
  }

  // Un seul réseau → stats détaillées
  if (entries.length === 1) {
    const [key, p] = entries[0];
    const c = MockAPI.COLORS[key];
    const statItems = [
      ['Abonnés',       fmt(p.followers),           p.handle||''],
      ['Vues',          fmt(p.views||0),             ''],
      ['Likes',         fmt(p.likes||0),             ''],
      ['Commentaires',  fmt(p.comments||0),          ''],
      ['Engagement',    (p.engagement||0)+'%',       ''],
      ['Publications',  fmt(p.posts||p.videos||0),   ''],
    ];
    grid.innerHTML = statItems.map(([label, value, sub]) =>
      `<div class="stat-card" style="--card-color:${c}">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${value}</div>
        ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
      </div>`
    ).join('');
    return;
  }

  // Multi → une carte par plateforme
  grid.innerHTML = entries.map(([key, p]) => {
    const c = MockAPI.COLORS[key];
    return `<div class="stat-card" style="--card-color:${c}">
      <div class="stat-label">${MockAPI.ICONS[key]} ${MockAPI.LABELS[key]}</div>
      <div class="stat-value">${fmt(p.followers||0)}</div>
      <div class="stat-sub">${p.engagement||0}% eng · ${fmt(p.likes||0)} likes</div>
    </div>`;
  }).join('');
}

// ── COMPARE ──────────────────────────────────────────────────
function renderCompare() {
  const grid = document.getElementById('platform-cards');
  if (!grid) return;
  const plats = MockAPI.getPlatforms();
  const entries = Object.entries(plats);
  const hasAny = entries.some(([,p]) => p && p.followers);

  if (!hasAny) {
    grid.innerHTML = emptyState('Aucune donnée', 'Configurez Apify dans Paramètres.');
    return;
  }

  grid.innerHTML = entries.map(([key, p]) => {
    const c = MockAPI.COLORS[key];
    if (!p || !p.followers) return `
      <div class="platform-card">
        <div class="platform-card-header">
          <div class="platform-logo" style="background:${hexA(c,0.1)}">${MockAPI.ICONS[key]}</div>
          <div><div class="platform-name">${MockAPI.LABELS[key]}</div><div class="platform-handle">Pas de données</div></div>
        </div>
      </div>`;

    return `<div class="platform-card">
      <div class="platform-card-header">
        <div class="platform-logo" style="background:${hexA(c,0.12)}">${MockAPI.ICONS[key]}</div>
        <div>
          <div class="platform-name" style="color:${c}">${MockAPI.LABELS[key]}</div>
          <div class="platform-handle">${p.handle||''}</div>
        </div>
      </div>
      ${[['Abonnés',fmt(p.followers)],['Vues',fmt(p.views||0)],['Likes',fmt(p.likes||0)],['Commentaires',fmt(p.comments||0)],['Engagement',(p.engagement||0)+'%'],['Publications',fmt(p.posts||p.videos||0)]]
        .map(([l,v])=>`<div class="platform-stat"><span style="color:var(--text-muted)">${l}</span><span class="platform-stat-val">${v}</span></div>`).join('')}
      ${p.lastUpdated ? `<div style="font-size:10px;color:var(--text-muted);margin-top:10px">Mis à jour : ${new Date(p.lastUpdated).toLocaleDateString('fr-FR')}</div>` : ''}
    </div>`;
  }).join('');
}

// ── POSTS ────────────────────────────────────────────────────
function renderPosts() {
  const el = document.getElementById('posts-content');
  if (!el) return;
  const posts = MockAPI.getTopPosts();
  if (!posts.length) { el.innerHTML = emptyState('Aucune publication', 'Les publications apparaîtront ici une fois Apify configuré.'); return; }

  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Titre</th><th>Plateforme</th><th>Vues</th><th>Likes</th><th>Commentaires</th><th>Engagement</th><th>Date</th></tr></thead>
    <tbody>${posts.map(p=>`<tr>
      <td style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.title||'—'}</td>
      <td><span class="plat-badge" style="background:${hexA(MockAPI.COLORS[p.platform]||'#6366F1',0.15)};color:${MockAPI.COLORS[p.platform]||'#6366F1'}">${MockAPI.LABELS[p.platform]||p.platform}</span></td>
      <td class="td-mono">${fmt(p.views||0)}</td>
      <td class="td-mono">${fmt(p.likes||0)}</td>
      <td class="td-mono">${fmt(p.comments||0)}</td>
      <td class="td-mono">${(p.engagement||0).toFixed(1)}%</td>
      <td class="td-muted">${p.date||'—'}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

// ── HISTORY ──────────────────────────────────────────────────
function renderHistory() {
  const el = document.getElementById('history-content');
  if (!el) return;
  const data = AppState.filtered;
  if (!data.length) { el.innerHTML = emptyState('Aucun historique', 'L\'historique apparaîtra ici après récupération via Apify.'); return; }

  const slice = data.slice(0, AppState.page * AppState.pageSize);
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Date</th><th>Plateforme</th><th>Titre</th><th>Vues</th><th>Likes</th><th>Engagement</th></tr></thead>
    <tbody>${slice.map(r=>`<tr>
      <td class="td-muted">${r.date||'—'}</td>
      <td><span class="plat-badge" style="background:${hexA(MockAPI.COLORS[r.platform]||'#6366F1',0.15)};color:${MockAPI.COLORS[r.platform]||'#6366F1'}">${MockAPI.LABELS[r.platform]||r.platform}</span></td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.title||'—'}</td>
      <td class="td-mono">${fmt(r.views||0)}</td>
      <td class="td-mono">${fmt(r.likes||0)}</td>
      <td class="td-mono">${(r.engagement||0).toFixed(1)}%</td>
    </tr>`).join('')}</tbody>
  </table></div>
  ${slice.length < data.length ? `<div style="text-align:center;margin-top:14px"><button class="btn-secondary" onclick="loadMore()">Charger plus (${data.length-slice.length} restants)</button></div>` : ''}`;
}

function loadMore() { AppState.page++; renderHistory(); }

function filterHistory() {
  const q = (document.getElementById('history-search')?.value||'').toLowerCase();
  AppState.filtered = AppState.history.filter(r => !q || (r.title||'').toLowerCase().includes(q) || r.platform.includes(q));
  AppState.page = 1;
  renderHistory();
}

// ── ALERTS ───────────────────────────────────────────────────
function renderAlerts() {
  const list = document.getElementById('alerts-list');
  if (!list) return;
  if (!AppState.alerts.length) { list.innerHTML = emptyState('Aucune alerte', 'Tout va bien.'); return; }
  list.innerHTML = AppState.alerts.map(a=>`
    <div class="alert-item ${a.read?'read':''}">
      <div class="alert-icon ${a.type}">${a.icon}</div>
      <div class="alert-body">
        <div class="alert-title">${a.title}</div>
        ${a.desc?`<div class="alert-desc">${a.desc}</div>`:''}
        ${a.time?`<div class="alert-time">${a.time}</div>`:''}
        <div class="alert-actions">
          ${!a.read?`<button class="alert-btn" onclick="markRead(${a.id})">Lu</button>`:''}
          <button class="alert-btn" onclick="dismissAlert(${a.id})">Ignorer</button>
        </div>
      </div>
    </div>`).join('');
}

function markRead(id) { const a=AppState.alerts.find(a=>a.id===id); if(a){a.read=true;renderAlerts();updateAlertBadge();} }
function dismissAlert(id) { AppState.alerts=AppState.alerts.filter(a=>a.id!==id); renderAlerts(); updateAlertBadge(); }
function markAllRead() { AppState.alerts.forEach(a=>a.read=true); renderAlerts(); updateAlertBadge(); showToast('✅ Tout marqué comme lu'); }
function updateAlertBadge() {
  const n=AppState.alerts.filter(a=>!a.read).length;
  const b=document.getElementById('alert-badge');
  if(b){b.textContent=n;b.style.display=n?'':'none';}
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
  if (!ApifyConfig.token || ApifyConfig.token === 'APIFY_TOKEN_ICI') {
    showToast('⚙️ Configurez le token dans Paramètres');
    navigateTo('settings'); return;
  }
  MockAPI.clearCache();
  await MockAPI.loadAll(true);
}

function clearAllCache() { MockAPI.clearCache(); showToast('🗑️ Cache vidé'); }

// ── EXPORT ───────────────────────────────────────────────────
function exportData(format) {
  const data = AppState.filtered.length ? AppState.filtered : AppState.history;
  if (!data.length) { showToast('Aucune donnée'); return; }
  if (format==='json') {
    download('afder_stats.json', JSON.stringify(data,null,2), 'application/json');
  } else {
    const cols=['date','platform','title','views','likes','comments','engagement'];
    const rows=[cols.join(','),...data.map(r=>cols.map(c=>`"${String(r[c]||'').replace(/"/g,'""')}"`).join(','))];
    download('afder_stats.csv', rows.join('\n'), 'text/csv');
  }
  showToast('📥 Export téléchargé');
}

function download(name, content, mime) {
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([content],{type:mime}));
  a.download=name; a.click(); URL.revokeObjectURL(a.href);
}

// ── UTILS ────────────────────────────────────────────────────
function fmt(n) {
  if(n>=1_000_000) return (n/1_000_000).toFixed(1)+'M';
  if(n>=1_000)     return (n/1_000).toFixed(1)+'k';
  return String(Math.round(n)||0);
}
function hexA(hex,a) {
  if(!hex||!hex.startsWith('#')) return `rgba(99,102,241,${a})`;
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}
function emptyState(title,desc) {
  return `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">${title}</div><div class="empty-state-desc">${desc}</div></div>`;
}
function setStatus(type,text) {
  const d=document.getElementById('status-dot'),t=document.getElementById('status-text');
  if(d) d.className=`status-dot ${type}`;
  if(t) t.textContent=text;
}
function showToast(msg,ms=3000) {
  const t=document.getElementById('toast');
  if(!t) return;
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),ms);
}
