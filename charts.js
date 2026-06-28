/**
 * charts.js — Gestion de tous les graphiques Chart.js
 * ============================================================
 * Chaque fonction crée ou met à jour un graphique spécifique.
 * Les graphiques utilisent un thème cohérent via CHART_DEFAULTS.
 * ============================================================
 */

// ── Chart.js global defaults ──────────────────────────────────
const CHART_DEFAULTS = {
  font:   'Inter, system-ui, sans-serif',
  color:  'rgba(248,250,252,0.6)',
  gridColor: 'rgba(255,255,255,0.05)',
};

Chart.defaults.color = CHART_DEFAULTS.color;
Chart.defaults.font.family = CHART_DEFAULTS.font;
Chart.defaults.font.size = 11;

// ── Chart registry (pour update/destroy) ─────────────────────
const ChartRegistry = {};

function destroyChart(id) {
  if (ChartRegistry[id]) { ChartRegistry[id].destroy(); delete ChartRegistry[id]; }
}

// ── Platform colors ───────────────────────────────────────────
const PC = {
  tiktok:    '#FF0050',
  instagram: '#E1306C',
  facebook:  '#1877F2',
  linkedin:  '#0077B5',
};

// ── Shared options builders ───────────────────────────────────
function baseLineOpts(tension=0.4) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode:'index', intersect:false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(26,26,36,0.95)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        padding: 10,
        titleFont: { weight:'600', size:12 },
        bodyFont:  { size:11 },
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { color: CHART_DEFAULTS.gridColor, drawBorder:false },
        ticks: { maxRotation:0, maxTicksLimit:8 },
        border: { display:false },
      },
      y: {
        grid: { color: CHART_DEFAULTS.gridColor, drawBorder:false },
        border: { display:false },
        ticks: { callback: v => MockAPI.fmt(v) },
      },
    },
  };
}

function makeGradient(ctx, color, alpha1=0.3, alpha2=0.0) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, color.replace(')', `,${alpha1})`).replace('rgb','rgba'));
  gradient.addColorStop(1, color.replace(')', `,${alpha2})`).replace('rgb','rgba'));
  // for hex colors use manual approach
  return gradient;
}

function hexToRgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function gradientFill(ctx, hex, h=220) {
  const g = ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0, hexToRgba(hex, 0.28));
  g.addColorStop(1, hexToRgba(hex, 0.01));
  return g;
}

// ── 1. Followers multi-line chart ─────────────────────────────
function buildFollowersChart(period='week') {
  const id = 'chart-followers';
  destroyChart(id);
  const el = document.getElementById(id);
  if (!el) return;
  const ctx = el.getContext('2d');
  const data = MockAPI.getFollowersChart(period);

  const ds = (label, key, color) => ({
    label,
    data: data.datasets[key],
    borderColor: color,
    backgroundColor: gradientFill(ctx, color),
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0.4,
    fill: true,
  });

  ChartRegistry[id] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        ds('TikTok',    'tiktok',    PC.tiktok),
        ds('Instagram', 'instagram', PC.instagram),
        ds('Facebook',  'facebook',  PC.facebook),
        ds('LinkedIn',  'linkedin',  PC.linkedin),
      ]
    },
    options: baseLineOpts(),
  });

  // Render legend
  const leg = document.getElementById('followers-legend');
  if (leg) {
    leg.innerHTML = Object.entries({TikTok:PC.tiktok, Instagram:PC.instagram, Facebook:PC.facebook, LinkedIn:PC.linkedin})
      .map(([n,c])=>`<div class="legend-item"><div class="legend-dot" style="background:${c}"></div>${n}</div>`).join('');
  }
}

// ── 2. Donut chart ───────────────────────────────────────────
function buildDonutChart() {
  const id = 'chart-donut';
  destroyChart(id);
  const el = document.getElementById(id); if (!el) return;
  const plat = MockAPI.getPlatforms();

  ChartRegistry[id] = new Chart(el.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['TikTok','Instagram','Facebook','LinkedIn'],
      datasets: [{
        data: [plat.tiktok.followers, plat.instagram.followers, plat.facebook.followers, plat.linkedin.followers],
        backgroundColor: [PC.tiktok, PC.instagram, PC.facebook, PC.linkedin],
        borderWidth: 0,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { position:'bottom', labels:{padding:14, usePointStyle:true, pointStyleWidth:8} },
        tooltip: {
          backgroundColor: 'rgba(26,26,36,0.95)',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          cornerRadius: 8,
          callbacks: { label: ctx => ` ${MockAPI.fmt(ctx.raw)} abonnés` },
        },
      },
    },
  });
}

// ── 3. Engagement chart ──────────────────────────────────────
function buildEngagementChart(period='week') {
  const id = 'chart-engagement';
  destroyChart(id);
  const el = document.getElementById(id); if (!el) return;
  const ctx = el.getContext('2d');
  const data = MockAPI.getEngagementChart(period);

  ChartRegistry[id] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        { label:'TikTok',    data:data.tiktok,    borderColor:PC.tiktok,    backgroundColor:'transparent', borderWidth:2, pointRadius:0, tension:0.4 },
        { label:'Instagram', data:data.instagram, borderColor:PC.instagram, backgroundColor:'transparent', borderWidth:2, pointRadius:0, tension:0.4 },
        { label:'Facebook',  data:data.facebook,  borderColor:PC.facebook,  backgroundColor:'transparent', borderWidth:2, pointRadius:0, tension:0.4 },
        { label:'LinkedIn',  data:data.linkedin,  borderColor:PC.linkedin,  backgroundColor:'transparent', borderWidth:2, pointRadius:0, tension:0.4 },
      ]
    },
    options: {
      ...baseLineOpts(),
      plugins: { ...baseLineOpts().plugins, legend:{ display:true, labels:{usePointStyle:true, pointStyleWidth:8, padding:12} } },
      scales: { ...baseLineOpts().scales, y:{ ...baseLineOpts().scales.y, ticks:{ callback: v => v+'%' } } },
    },
  });
}

// ── 4. Reach chart ──────────────────────────────────────────
function buildReachChart(period='week') {
  const id = 'chart-reach';
  destroyChart(id);
  const el = document.getElementById(id); if (!el) return;
  const ctx = el.getContext('2d');
  const data = MockAPI.getReachChart(period);

  ChartRegistry[id] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [
        { label:'Portée',       data:data.reach,       backgroundColor:hexToRgba('#6366F1',0.7), borderRadius:4, borderSkipped:false },
        { label:'Impressions',  data:data.impressions, backgroundColor:hexToRgba('#22D3EE',0.5), borderRadius:4, borderSkipped:false },
      ]
    },
    options: {
      ...baseLineOpts(),
      plugins: { ...baseLineOpts().plugins, legend:{ display:true, labels:{ usePointStyle:true, pointStyleWidth:8, padding:12 } } },
      scales: { ...baseLineOpts().scales, y:{ ...baseLineOpts().scales.y, ticks:{ callback: v=>MockAPI.fmt(v) } } },
    },
  });
}

// ── 5. Daily views ──────────────────────────────────────────
function buildDailyViewsChart() {
  const id = 'chart-daily-views';
  destroyChart(id);
  const el = document.getElementById(id); if (!el) return;
  const ctx = el.getContext('2d');
  const {labels, data} = MockAPI.getDailyViews(30);

  ChartRegistry[id] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label:'Vues',
        data,
        borderColor:'#6366F1',
        backgroundColor: gradientFill(ctx,'#6366F1',300),
        borderWidth:2,
        pointRadius:0,
        tension:0.4,
        fill:true,
      }]
    },
    options: baseLineOpts(),
  });
}

// ── 6. Likes & Comments ─────────────────────────────────────
function buildLikesChart() {
  const id = 'chart-likes';
  destroyChart(id);
  const el = document.getElementById(id); if (!el) return;
  const {labels, likes, comments} = MockAPI.getLikesComments(30);

  ChartRegistry[id] = new Chart(el.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'Likes',       data:likes,    backgroundColor:hexToRgba('#6366F1',0.75), borderRadius:3, borderSkipped:false },
        { label:'Commentaires',data:comments, backgroundColor:hexToRgba('#22D3EE',0.6),  borderRadius:3, borderSkipped:false },
      ]
    },
    options: {
      ...baseLineOpts(),
      plugins: { ...baseLineOpts().plugins, legend:{ display:true, labels:{ usePointStyle:true, pointStyleWidth:8, padding:12 } } },
    },
  });
}

// ── 7. Monthly chart ─────────────────────────────────────────
function buildMonthlyChart() {
  const id = 'chart-monthly';
  destroyChart(id);
  const el = document.getElementById(id); if (!el) return;
  const ctx = el.getContext('2d');
  const {labels, followers} = MockAPI.getMonthlyData();

  ChartRegistry[id] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label:'Abonnés',
        data:followers,
        borderColor:'#10B981',
        backgroundColor:gradientFill(ctx,'#10B981'),
        borderWidth:2, pointRadius:3, pointBackgroundColor:'#10B981', tension:0.4, fill:true,
      }]
    },
    options: baseLineOpts(),
  });
}

// ── 8. Annual growth ─────────────────────────────────────────
function buildAnnualChart() {
  const id = 'chart-annual';
  destroyChart(id);
  const el = document.getElementById(id); if (!el) return;
  const {labels, data} = MockAPI.getAnnualGrowth();

  ChartRegistry[id] = new Chart(el.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label:'Croissance (%)',
        data,
        backgroundColor: data.map(v => v>=0 ? hexToRgba('#10B981',0.75) : hexToRgba('#EF4444',0.75)),
        borderRadius:5, borderSkipped:false,
      }]
    },
    options: {
      ...baseLineOpts(),
      scales: { ...baseLineOpts().scales, y:{ ...baseLineOpts().scales.y, ticks:{ callback: v=>v+'%' } } },
    },
  });
}

// ── 9. Compare bar chart ─────────────────────────────────────
function buildCompareChart() {
  const id = 'chart-compare';
  destroyChart(id);
  const el = document.getElementById(id); if (!el) return;
  const data = MockAPI.getCompareChart();

  ChartRegistry[id] = new Chart(el.getContext('2d'), {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        { label:'TikTok',    data:data.tiktok,    borderColor:PC.tiktok,    backgroundColor:'transparent', borderWidth:2, pointRadius:0, tension:0.4 },
        { label:'Instagram', data:data.instagram, borderColor:PC.instagram, backgroundColor:'transparent', borderWidth:2, pointRadius:0, tension:0.4 },
        { label:'Facebook',  data:data.facebook,  borderColor:PC.facebook,  backgroundColor:'transparent', borderWidth:2, pointRadius:0, tension:0.4 },
        { label:'LinkedIn',  data:data.linkedin,  borderColor:PC.linkedin,  backgroundColor:'transparent', borderWidth:2, pointRadius:0, tension:0.4 },
      ]
    },
    options: {
      ...baseLineOpts(),
      plugins: { ...baseLineOpts().plugins, legend:{ display:true, labels:{ usePointStyle:true, pointStyleWidth:8, padding:12 } } },
    },
  });
}

// ── 10. Radar chart ──────────────────────────────────────────
function buildRadarChart() {
  const id = 'chart-radar';
  destroyChart(id);
  const el = document.getElementById(id); if (!el) return;

  const METRICS = ['Abonnés','Engagement','Portée','Likes','Partages','Commentaires'];
  const normalize = (v, max) => Math.round(v/max*100);

  ChartRegistry[id] = new Chart(el.getContext('2d'), {
    type: 'radar',
    data: {
      labels: METRICS,
      datasets: [
        { label:'TikTok',    data:[normalize(18400,20000),normalize(4.8,8),normalize(280000,350000),normalize(41200,50000),normalize(7200,10000),normalize(3800,5000)], borderColor:PC.tiktok,    backgroundColor:hexToRgba(PC.tiktok,0.15),    borderWidth:2, pointRadius:3 },
        { label:'Instagram', data:[normalize(9250,20000),normalize(3.4,8),normalize(140000,350000),normalize(18600,50000),normalize(2800,10000),normalize(1240,5000)],  borderColor:PC.instagram, backgroundColor:hexToRgba(PC.instagram,0.1), borderWidth:2, pointRadius:3 },
        { label:'LinkedIn',  data:[normalize(2380,20000),normalize(5.6,8),normalize(34000,350000), normalize(3200,50000), normalize(940,10000),  normalize(480,5000)],   borderColor:PC.linkedin,  backgroundColor:hexToRgba(PC.linkedin,0.1),  borderWidth:2, pointRadius:3 },
        { label:'Facebook',  data:[normalize(6120,20000),normalize(2.1,8),normalize(78000,350000), normalize(7400,50000), normalize(1900,10000), normalize(890,5000)],   borderColor:PC.facebook,  backgroundColor:hexToRgba(PC.facebook,0.1),  borderWidth:2, pointRadius:3 },
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      scales: {
        r: {
          backgroundColor: 'rgba(255,255,255,0.02)',
          grid: { color:'rgba(255,255,255,0.07)' },
          angleLines: { color:'rgba(255,255,255,0.05)' },
          pointLabels: { font:{ size:11 } },
          ticks: { display:false },
        }
      },
      plugins: {
        legend: { position:'bottom', labels:{ usePointStyle:true, pointStyleWidth:8, padding:14 } },
        tooltip: { backgroundColor:'rgba(26,26,36,0.95)', borderColor:'rgba(255,255,255,0.08)', borderWidth:1, cornerRadius:8 },
      },
    },
  });
}

// ── 11. Sparklines (mini charts in stat cards) ───────────────
function buildSparkline(canvasId, data, color) {
  const el = document.getElementById(canvasId); if (!el) return;
  const ctx = el.getContext('2d');

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map((_,i)=>i),
      datasets: [{
        data,
        borderColor: color,
        backgroundColor: gradientFill(ctx, color, 50),
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.4,
        fill: true,
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{enabled:false} },
      scales:{ x:{display:false}, y:{display:false} },
      animation:{ duration:800 },
    },
  });
}

// ── Update all period-sensitive charts ───────────────────────
function updateAllCharts(period) {
  buildFollowersChart(period);
  buildEngagementChart(period);
  buildReachChart(period);
}
