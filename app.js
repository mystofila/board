/**
 * app.js — Logique principale du dashboard
 * ============================================================
 * Gère: navigation, rendu des composants, état global,
 * filtres, export CSV/Excel/JSON, thème, objectifs, alertes.
 * ============================================================
 */

/* ── État global ─────────────────────────────────────────── */
const AppState = {
  period:          'week',
  historyData:     [],
  filteredHistory: [],
  historyPage:     1,
  historyPageSize: 15,
  goals:           [],
  alerts:          [],
  calendarYear:    new Date().getFullYear(),
  calendarMonth:   new Date().getMonth(),
  settings: {
    theme:      'dark',
    accent:     '#6366F1',
    alert_records:    true,
    alert_engagement: true,
    alert_no_post:    false,
    goal_followers:   50000,
    goal_engagement:  4.5,
    goal_posts:       5,
  },
};

/* ── Init ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  AppState.historyData = MockAPI.getHistory();
  AppState.filteredHistory = [...AppState.historyData];
  AppState.goals   = MockAPI.getGoals();
  AppState.alerts  = MockAPI.getAlerts();

  renderStatCards();
  buildFollowersChart(AppState.period);
  buildDonutChart();
  buildEngagementChart(AppState.period);
  buildReachChart(AppState.period);
  renderHeatmap();
  renderTopPosts();
  renderTimeline();

  // Sidebar overlay for mobile
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebar-overlay';
  overlay.onclick = () => { document.getElementById('sidebar').classList.remove('open'); overlay.classList.remove('open'); };
  document.body.appendChild(overlay);
});

/* ── Navigation ──────────────────────────────────────────── */
function navigateTo(page) {
  // Deactivate all pages & nav items
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Activate target
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  // Lazy-render page content
  switch(page) {
    case 'analytics': renderAnalyticsPage(); break;
    case 'compare':   renderComparePage(); break;
    case 'posts':     renderPostsTable(); break;
    case 'calendar':  renderCalendar(); break;
    case 'goals':     renderGoals(); break;
    case 'history':   renderHistory(); break;
    case 'alerts':    renderAlerts(); break;
    case 'settings':  renderApiConnections(); break;
  }

  // Close sidebar on mobile
  if (window.innerWidth < 900) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('open');
  }
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  sb.classList.toggle('open');
  ov?.classList.toggle('open');
}

/* ── Period ──────────────────────────────────────────────── */
function setPeriod(period, btn) {
  AppState.period = period;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const label = { day:'Aujourd\'hui', week:'7 derniers jours', month:'30 derniers jours', year:'Cette année' };
  const el = document.getElementById('period-label');
  if (el) el.textContent = label[period] || '';

  renderStatCards();
  updateAllCharts(period);
}

/* ── STAT CARDS ──────────────────────────────────────────── */
const STAT_CONFIG = [
  { key:'followers',  label:'Abonnés',    icon:'👥', accent:'#6366F1', format:'fmt' },
  { key:'views',      label:'Vues',       icon:'👁️', accent:'#22D3EE', format:'fmt' },
  { key:'likes',      label:'Likes',      icon:'❤️', accent:'#E1306C', format:'fmt' },
  { key:'engagement', label:'Engagement', icon:'📊', accent:'#10B981', format:'pct' },
  { key:'growth',     label:'Croissance', icon:'📈', accent:'#F59E0B', format:'fmt' },
];

function renderStatCards() {
  const stats = MockAPI.getStats(AppState.period);
  const grid  = document.getElementById('stat-cards');
  if (!grid) return;

  grid.innerHTML = STAT_CONFIG.map(cfg => {
    const s = stats[cfg.key];
    if (!s) return '';
    const formatted = cfg.format === 'pct' ? `${s.value}%` : MockAPI.fmt(s.value);
    const isUp = s.change >= 0;
    const arrow = isUp ? '↑' : '↓';
    const changeStr = `${arrow} ${Math.abs(s.change)}${cfg.format==='pct'?'pp':'%'}`;
    const sparkId = `spark-${cfg.key}`;

    return `
      <div class="stat-card" style="--card-accent:${cfg.accent}">
        <div class="stat-header">
          <div class="stat-label">${cfg.label}</div>
          <div class="stat-icon" style="background:${cfg.accent}20;color:${cfg.accent}">${cfg.icon}</div>
        </div>
        <div class="stat-value">${formatted}</div>
        <div class="stat-footer">
          <div class="stat-change ${isUp?'up':'down'}">${changeStr} <span style="font-weight:400;color:var(--text-muted)">vs précédent</span></div>
          <div class="sparkline-wrap"><canvas id="${sparkId}" width="80" height="36"></canvas></div>
        </div>
      </div>`;
  }).join('');

  // Build sparklines after DOM insert
  requestAnimationFrame(() => {
    STAT_CONFIG.forEach(cfg => {
      const s = stats[cfg.key];
      if (s) buildSparkline(`spark-${cfg.key}`, s.sparkData, cfg.accent);
    });
  });
}

/* ── HEATMAP ─────────────────────────────────────────────── */
function renderHeatmap() {
  const container = document.getElementById('heatmap-container');
  if (!container) return;
  const data = MockAPI.getHeatmap();
  const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const max  = Math.max(...data.flat());

  const hourLabels = Array.from({length:24}, (_,i)=>i%3===0?`${i}h`:'');

  let html = `<div class="heatmap-table">
    <div></div>${hourLabels.map(h=>`<div class="heatmap-hour-label">${h}</div>`).join('')}`;

  data.forEach((row, di) => {
    html += `<div class="heatmap-day-label">${days[di]}</div>`;
    row.forEach((val, hi) => {
      const intensity = val / max;
      const alpha = (0.06 + intensity * 0.88).toFixed(2);
      const bg = `rgba(99,102,241,${alpha})`;
      html += `<div class="heatmap-cell" style="background:${bg}" title="${days[di]} ${hi}h — ${val} interactions"></div>`;
    });
  });
  html += '</div>';
  container.innerHTML = html;
}

/* ── TOP POSTS ───────────────────────────────────────────── */
function renderTopPosts() {
  const el = document.getElementById('top-posts-list');
  if (!el) return;
  const posts = MockAPI.getTopPosts();
  const ranks = ['gold','silver','bronze','',''];

  el.innerHTML = posts.map((p, i) => `
    <div class="top-post-item">
      <div class="post-rank ${ranks[i]}">${i+1}</div>
      <div class="post-thumb" style="background:${hexToRgba(MockAPI.PLATFORMS[p.platform]?.color||'#6366F1',0.15)}">${p.emoji}</div>
      <div class="post-info">
        <div class="post-title-text">${p.title}</div>
        <div class="post-meta-text">${p.date}</div>
      </div>
      <div>
        <div class="post-stat-val">${MockAPI.fmt(p.likes)}</div>
        <div class="post-stat-sub">likes</div>
      </div>
      <div style="margin-left:8px">
        <div class="post-stat-val">${MockAPI.fmt(p.views)}</div>
        <div class="post-stat-sub">vues</div>
      </div>
      <span class="platform-badge ${p.platform}">${p.platform}</span>
    </div>`).join('');
}

function hexToRgba(hex, a) {
  if (!hex || !hex.startsWith('#')) return `rgba(99,102,241,${a})`;
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ── TIMELINE ────────────────────────────────────────────── */
function renderTimeline() {
  const el = document.getElementById('timeline-list');
  if (!el) return;
  const events = MockAPI.getTimeline();

  el.innerHTML = events.map(e => `
    <div class="timeline-item">
      <div class="timeline-dot ${e.type}">${e.icon}</div>
      <div class="timeline-content">
        <div class="timeline-event">${e.event}</div>
        <div class="timeline-time">${e.time}</div>
      </div>
    </div>`).join('');
}

/* ── ANALYTICS PAGE ──────────────────────────────────────── */
function renderAnalyticsPage() {
  requestAnimationFrame(() => {
    buildDailyViewsChart();
    buildLikesChart();
    buildMonthlyChart();
    buildAnnualChart();
  });
}

/* ── COMPARE PAGE ────────────────────────────────────────── */
function renderComparePage() {
  const grid = document.getElementById('platform-cards');
  if (!grid) return;
  const plat = MockAPI.getPlatforms();

  grid.innerHTML = Object.entries(plat).map(([key, p]) => `
    <div class="platform-card">
      <div class="platform-card-header">
        <div class="platform-logo" style="background:${hexToRgba(p.color,0.15)}">${p.emoji}</div>
        <div>
          <div class="platform-name" style="color:${p.color}">${p.name}</div>
          <div class="platform-handle">${p.handle}</div>
        </div>
      </div>
      ${[
        ['Abonnés', MockAPI.fmt(p.followers)],
        ['Vues',    MockAPI.fmt(p.views)],
        ['Likes',   MockAPI.fmt(p.likes)],
        ['Engagement', p.engagement+'%'],
        ['Publications', p.posts],
      ].map(([label, val]) => `
        <div class="platform-stat">
          <span style="color:var(--text-muted)">${label}</span>
          <span class="platform-stat-val">${val}</span>
        </div>`).join('')}
    </div>`).join('');

  requestAnimationFrame(() => {
    buildCompareChart();
    buildRadarChart();
  });
}

/* ── POSTS TABLE ─────────────────────────────────────────── */
function renderPostsTable() {
  const posts = MockAPI.getTopPosts().concat(
    MockAPI.getHistory().slice(0,20).map(h => ({
      id:h.id, title:h.title, platform:h.platform, likes:h.likes,
      views:h.views, comments:h.comments, engagement:h.engagement, date:h.date, emoji:'📄'
    }))
  );
  const platFilter = document.getElementById('posts-platform-filter')?.value || 'all';
  const sortKey    = document.getElementById('posts-sort-filter')?.value || 'likes';

  let filtered = platFilter === 'all' ? posts : posts.filter(p => p.platform === platFilter);
  filtered.sort((a,b) => (b[sortKey]||0) - (a[sortKey]||0));

  const wrap = document.getElementById('posts-table-wrap');
  if (!wrap) return;

  wrap.innerHTML = `<table>
    <thead><tr>
      <th>Titre</th>
      <th>Plateforme</th>
      <th>Vues</th>
      <th>Likes</th>
      <th>Commentaires</th>
      <th>Engagement</th>
      <th>Date</th>
    </tr></thead>
    <tbody>
      ${filtered.map(p=>`<tr>
        <td>${p.emoji||'📄'} ${p.title}</td>
        <td><span class="platform-badge ${p.platform}">${p.platform}</span></td>
        <td class="td-mono">${MockAPI.fmt(p.views||0)}</td>
        <td class="td-mono">${MockAPI.fmt(p.likes||0)}</td>
        <td class="td-mono">${MockAPI.fmt(p.comments||0)}</td>
        <td class="td-mono">${(p.engagement||0).toFixed(1)}%</td>
        <td class="td-muted">${p.date||'—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function filterPosts() { renderPostsTable(); }

/* ── CALENDAR ────────────────────────────────────────────── */
function renderCalendar() {
  const {calendarYear: y, calendarMonth: m} = AppState;
  const label = document.getElementById('cal-month-label');
  const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  if (label) label.textContent = `${months[m]} ${y}`;

  const events  = MockAPI.getCalendarEvents(y, m);
  const eventMap = {};
  events.forEach(e => {
    eventMap[e.date] = (eventMap[e.date]||[]);
    eventMap[e.date].push(e);
  });

  const firstDay = new Date(y, m, 1).getDay();
  const daysInM  = new Date(y, m+1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const today    = new Date();
  const isCurrentMonth = today.getFullYear()===y && today.getMonth()===m;

  const grid = document.getElementById('calendar-grid');
  if (!grid) return;

  let html = `<div class="cal-header-row">${['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'].map(d=>`<div>${d}</div>`).join('')}</div>
  <div class="cal-grid">`;

  // Prev month fill
  for (let i = firstDay-1; i >= 0; i--) {
    html += `<div class="cal-cell other-month">${prevDays-i}</div>`;
  }

  for (let d = 1; d <= daysInM; d++) {
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayEvents = eventMap[dateStr] || [];
    const isToday = isCurrentMonth && today.getDate()===d;
    const cls = ['cal-cell', isToday?'today':'', dayEvents.length===1?'has-post':dayEvents.length>1?'multi-post':''].filter(Boolean).join(' ');
    html += `<div class="${cls}" title="${dayEvents.map(e=>e.title).join(', ')}">${d}</div>`;
  }

  // Next month fill
  const total = firstDay + daysInM;
  const remaining = 7 - (total % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) html += `<div class="cal-cell other-month">${d}</div>`;
  }

  html += '</div>';
  grid.innerHTML = html;

  // Events list
  const evList = document.getElementById('calendar-events-list');
  if (evList) {
    if (events.length === 0) {
      evList.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Aucune publication ce mois.</div>';
    } else {
      evList.innerHTML = events.slice(0,10).map(e=>`
        <div class="cal-event-item">
          <span class="cal-event-date">${e.date.split('-')[2]}/${e.date.split('-')[1]}</span>
          <span class="platform-badge ${e.platform}">${e.platform}</span>
          <span>${e.title}</span>
        </div>`).join('');
    }
  }
}

function changeMonth(dir) {
  AppState.calendarMonth += dir;
  if (AppState.calendarMonth > 11) { AppState.calendarMonth = 0; AppState.calendarYear++; }
  if (AppState.calendarMonth < 0)  { AppState.calendarMonth = 11; AppState.calendarYear--; }
  renderCalendar();
}

/* ── GOALS ───────────────────────────────────────────────── */
function renderGoals() {
  const grid = document.getElementById('goals-grid');
  if (!grid) return;

  grid.innerHTML = `<div class="goals-grid">${AppState.goals.map(g => {
    const pct = Math.min(100, Math.round(g.current/g.target*100));
    const daysLeft = g.due ? Math.ceil((new Date(g.due)-new Date())/(1000*60*60*24)) : null;
    return `
      <div class="goal-card">
        <div class="goal-header">
          <div>
            <div class="goal-title">${g.title}</div>
            <div class="goal-platform">${g.platform} ${g.due?'· Échéance '+g.due:''}</div>
          </div>
          <div style="text-align:right">
            <div class="progress-pct">${pct}%</div>
            ${daysLeft!==null ? `<div class="goal-due">${daysLeft>0?daysLeft+'j restants':'Échéance passée'}</div>` : ''}
          </div>
        </div>
        <div class="progress-wrap">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${g.color},${g.color}99)"></div>
          </div>
          <div class="progress-labels">
            <span>${MockAPI.fmt(g.current)}</span>
            <span>Cible: ${MockAPI.fmt(g.target)}</span>
          </div>
        </div>
      </div>`;
  }).join('')}</div>`;
}

function openGoalModal() {
  document.getElementById('goal-modal').classList.add('open');
}
function closeGoalModal(e) {
  if (!e || e.target.id==='goal-modal') document.getElementById('goal-modal').classList.remove('open');
}
function addGoal() {
  const title   = document.getElementById('new-goal-title').value.trim();
  const platform= document.getElementById('new-goal-platform').value;
  const target  = parseFloat(document.getElementById('new-goal-target').value) || 1000;
  const current = parseFloat(document.getElementById('new-goal-current').value) || 0;
  const due     = document.getElementById('new-goal-date').value;
  if (!title) return showToast('⚠️ Titre requis');

  AppState.goals.push({
    id: Date.now(), title, platform, current, target, due,
    color: { tiktok:'#FF0050', instagram:'#E1306C', facebook:'#1877F2', linkedin:'#0077B5', global:'#6366F1' }[platform]||'#6366F1',
  });
  closeGoalModal();
  renderGoals();
  showToast('✅ Objectif créé');
}

/* ── HISTORY TABLE ───────────────────────────────────────── */
function renderHistory() {
  const wrap = document.getElementById('history-table-wrap');
  if (!wrap) return;
  const {filteredHistory, historyPage, historyPageSize} = AppState;
  const total = filteredHistory.length;
  const start = (historyPage-1)*historyPageSize;
  const slice = filteredHistory.slice(start, start+historyPageSize);

  wrap.innerHTML = `<table>
    <thead><tr>
      <th onclick="sortHistory('date')">Date ↕</th>
      <th>Plateforme</th>
      <th onclick="sortHistory('title')">Titre</th>
      <th onclick="sortHistory('views')">Vues ↕</th>
      <th onclick="sortHistory('likes')">Likes ↕</th>
      <th onclick="sortHistory('comments')">Commentaires</th>
      <th onclick="sortHistory('engagement')">Engagement ↕</th>
      <th onclick="sortHistory('reach')">Portée</th>
    </tr></thead>
    <tbody>${slice.map(r=>`<tr>
      <td class="td-muted">${r.date}</td>
      <td><span class="platform-badge ${r.platform}">${r.platform}</span></td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.title}</td>
      <td class="td-mono">${MockAPI.fmt(r.views)}</td>
      <td class="td-mono">${MockAPI.fmt(r.likes)}</td>
      <td class="td-mono">${MockAPI.fmt(r.comments)}</td>
      <td class="td-mono">${r.engagement.toFixed(1)}%</td>
      <td class="td-mono">${MockAPI.fmt(r.reach)}</td>
    </tr>`).join('')}</tbody>
  </table>`;

  // Pagination
  const pages = Math.ceil(total/historyPageSize);
  const pag   = document.getElementById('history-pagination');
  if (!pag) return;
  pag.innerHTML = Array.from({length:pages}, (_,i)=>i+1)
    .filter(n => n===1 || n===pages || Math.abs(n-historyPage)<=2)
    .map(n=>`<div class="page-num ${n===historyPage?'active':''}" onclick="goHistoryPage(${n})">${n}</div>`)
    .join('');
}

function filterHistory() {
  const q    = (document.getElementById('history-search')?.value||'').toLowerCase();
  const plat = document.getElementById('history-platform')?.value||'all';
  AppState.filteredHistory = AppState.historyData.filter(r =>
    (plat==='all' || r.platform===plat) &&
    (!q || r.title.toLowerCase().includes(q) || r.platform.includes(q))
  );
  AppState.historyPage = 1;
  renderHistory();
}

function sortHistory(key) {
  AppState.filteredHistory.sort((a,b) => {
    if (typeof a[key]==='number') return b[key]-a[key];
    return String(b[key]).localeCompare(String(a[key]));
  });
  renderHistory();
}

function goHistoryPage(n) {
  AppState.historyPage = n;
  renderHistory();
}

/* ── ALERTS ──────────────────────────────────────────────── */
function renderAlerts() {
  const list = document.getElementById('alerts-list');
  if (!list) return;

  list.innerHTML = AppState.alerts.map(a=>`
    <div class="alert-item ${a.read?'read':''}" id="alert-${a.id}">
      <div class="alert-icon ${a.type}">${a.icon}</div>
      <div class="alert-body">
        <div class="alert-title">${a.title}</div>
        <div class="alert-desc">${a.desc}</div>
        <div class="alert-time">${a.time}</div>
        <div class="alert-actions">
          ${!a.read?`<button class="alert-btn" onclick="markRead(${a.id})">Marquer comme lu</button>`:''}
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
  renderAlerts();
  updateAlertBadge();
}
function markAllRead() {
  AppState.alerts.forEach(a=>a.read=true);
  renderAlerts();
  updateAlertBadge();
  showToast('✅ Toutes les alertes marquées comme lues');
}
function updateAlertBadge() {
  const badge = document.getElementById('alert-badge');
  const unread = AppState.alerts.filter(a=>!a.read).length;
  if (badge) { badge.textContent = unread; badge.style.display = unread?'':'none'; }
}

/* ── SETTINGS ────────────────────────────────────────────── */
function renderApiConnections() {
  const el = document.getElementById('api-connections');
  if (!el) return;
  const conns = [
    { name:'TikTok API',    status:'connected',    key:'tiktok' },
    { name:'Instagram API', status:'connected',    key:'instagram' },
    { name:'Facebook API',  status:'connected',    key:'facebook' },
    { name:'LinkedIn API',  status:'disconnected', key:'linkedin' },
    { name:'SQLite / JSON', status:'connected',    key:'db' },
  ];
  el.innerHTML = conns.map(c=>`
    <div class="api-connection">
      <span>${c.name}</span>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="api-status ${c.status}">${c.status==='connected'?'● Connecté':'○ Déconnecté'}</span>
        <button class="btn-secondary" style="font-size:11px;padding:4px 10px">${c.status==='connected'?'Configurer':'Connecter'}</button>
      </div>
    </div>`).join('');
}

function setTheme(theme, btn) {
  AppState.settings.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  saveSettings();
}

function setAccent(color, el) {
  AppState.settings.accent = color;
  document.documentElement.style.setProperty('--accent', color);
  // Update glow
  const r=parseInt(color.slice(1,3),16), g=parseInt(color.slice(3,5),16), b=parseInt(color.slice(5,7),16);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.25)`);
  document.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('active'));
  el.classList.add('active');
  saveSettings();
  showToast('🎨 Couleur d\'accent mise à jour');
}

function saveSetting(key, value) {
  AppState.settings[key] = value;
  saveSettings();
}

function saveAllSettings() {
  const gf = document.getElementById('goal-followers')?.value;
  const ge = document.getElementById('goal-engagement')?.value;
  const gp = document.getElementById('goal-posts')?.value;
  if (gf) AppState.settings.goal_followers   = parseFloat(gf);
  if (ge) AppState.settings.goal_engagement  = parseFloat(ge);
  if (gp) AppState.settings.goal_posts       = parseInt(gp);
  saveSettings();
  showToast('✅ Paramètres enregistrés');
}

function saveSettings() {
  try { localStorage.setItem('dashboard_settings', JSON.stringify(AppState.settings)); } catch(e){}
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('dashboard_settings')||'{}');
    Object.assign(AppState.settings, s);
    if (s.theme)  document.documentElement.setAttribute('data-theme', s.theme);
    if (s.accent) {
      document.documentElement.style.setProperty('--accent', s.accent);
      const r=parseInt(s.accent.slice(1,3),16), g=parseInt(s.accent.slice(3,5),16), b=parseInt(s.accent.slice(5,7),16);
      document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.25)`);
    }
  } catch(e){}
}

/* ── EXPORT ──────────────────────────────────────────────── */
function exportData(format) {
  const data = AppState.filteredHistory.length ? AppState.filteredHistory : AppState.historyData;

  if (format === 'json') {
    download('historique_afder.json', JSON.stringify(data, null, 2), 'application/json');
  } else if (format === 'csv') {
    const cols = ['id','date','platform','title','views','likes','comments','shares','engagement','reach'];
    const rows = [cols.join(',')];
    data.forEach(r => rows.push(cols.map(c => `"${String(r[c]||'').replace(/"/g,'""')}"`).join(',')));
    download('historique_afder.csv', rows.join('\n'), 'text/csv');
  } else if (format === 'excel') {
    // TSV which Excel opens natively
    const cols = ['id','date','platform','title','views','likes','comments','shares','engagement','reach'];
    const rows = [cols.join('\t')];
    data.forEach(r => rows.push(cols.map(c => r[c]||'').join('\t')));
    download('historique_afder.xls', rows.join('\n'), 'application/vnd.ms-excel');
  }
  showToast(`📥 Export ${format.toUpperCase()} téléchargé`);
}

function download(filename, content, mime) {
  const a   = document.createElement('a');
  a.href    = URL.createObjectURL(new Blob([content], {type: mime}));
  a.download= filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ── TOAST ───────────────────────────────────────────────── */
function showToast(msg, duration=3000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

/* ── SEARCH ──────────────────────────────────────────────── */
document.getElementById('global-search')?.addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) return;
  // Navigate to history and filter
  navigateTo('history');
  document.getElementById('history-search').value = q;
  filterHistory();
});
