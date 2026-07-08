/**
 * charts.js — Graphiques basés sur l'historique réel (MockAPI._raw)
 */
Chart.defaults.color = 'rgba(248,250,252,0.5)';
Chart.defaults.font.family = 'Inter, sans-serif';
Chart.defaults.font.size = 11;

const ChartReg = {};

function destroyChart(id) {
  if (ChartReg[id]) { ChartReg[id].destroy(); delete ChartReg[id]; }
}

function hexA(hex, a) {
  if (!hex || !hex.startsWith('#')) return `rgba(99,102,241,${a})`;
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function grad(ctx, hex) {
  const g = ctx.createLinearGradient(0, 0, 0, 200);
  g.addColorStop(0, hexA(hex, 0.3));
  g.addColorStop(1, hexA(hex, 0.02));
  return g;
}

const baseOpts = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(26,26,36,0.95)',
      borderColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      cornerRadius: 8,
      padding: 10,
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      border: { display: false },
      ticks: { maxTicksLimit: 8, maxRotation: 0 },
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      border: { display: false },
      ticks: { callback: v => MockAPI.fmt(v) },
    },
  },
};

// Récupère toutes les dates uniques triées
function getDates() {
  return [...new Set(MockAPI._raw.map(e => e.date).filter(Boolean))].sort();
}

// Récupère la valeur d'un champ pour une plateforme à une date
function getValue(platform, date, field) {
  const e = MockAPI._raw.find(r => r.platform === platform && r.date === date);
  return e ? (e[field] || 0) : null;
}

function buildFollowersChart(plats) {
  const id = 'chart-followers';
  destroyChart(id);
  const el = document.getElementById(id); if (!el) return;
  const ctx = el.getContext('2d');

  const keys   = Object.keys(plats).filter(k => plats[k]);
  const dates  = getDates();
  if (!dates.length || !keys.length) return;

  const labels   = dates.map(d => d.slice(5)); // MM-DD
  const datasets = keys.map(key => ({
    label:            MockAPI.LABELS[key],
    data:             dates.map(d => getValue(key, d, 'followers')),
    borderColor:      MockAPI.COLORS[key],
    backgroundColor:  grad(ctx, MockAPI.COLORS[key]),
    borderWidth:      2,
    pointRadius:      dates.length > 1 ? 4 : 6,
    pointBackgroundColor: MockAPI.COLORS[key],
    tension:          0.4,
    fill:             true,
    spanGaps:         true,
  }));

  ChartReg[id] = new Chart(ctx, { type: 'line', data: { labels, datasets }, options: baseOpts });

  const leg = document.getElementById('followers-legend');
  if (leg) leg.innerHTML = keys.map(k =>
    `<div class="legend-item"><div class="legend-dot" style="background:${MockAPI.COLORS[k]}"></div>${MockAPI.LABELS[k]}</div>`
  ).join('');
}

function buildDonutChart(plats) {
  const id = 'chart-donut';
  destroyChart(id);
  const el = document.getElementById(id); if (!el) return;

  const entries = Object.entries(plats).filter(([, p]) => p && p.followers);
  if (!entries.length) return;

  ChartReg[id] = new Chart(el.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels:   entries.map(([k]) => MockAPI.LABELS[k]),
      datasets: [{
        data:            entries.map(([, p]) => p.followers),
        backgroundColor: entries.map(([k]) => MockAPI.COLORS[k]),
        borderWidth: 0,
        hoverOffset: 5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 7 } },
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

function buildEngagementChart(plats) {
  const id = 'chart-engagement';
  destroyChart(id);
  const el = document.getElementById(id); if (!el) return;

  const keys  = Object.keys(plats).filter(k => plats[k]);
  const dates = getDates();
  if (!dates.length || !keys.length) return;

  const labels   = dates.map(d => d.slice(5));
  const datasets = keys.map(key => ({
    label:       MockAPI.LABELS[key],
    data:        dates.map(d => getValue(key, d, 'engagement')),
    borderColor: MockAPI.COLORS[key],
    backgroundColor: 'transparent',
    borderWidth: 2,
    pointRadius: dates.length > 1 ? 3 : 5,
    tension:     0.4,
    spanGaps:    true,
  }));

  ChartReg[id] = new Chart(el.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      ...baseOpts,
      plugins: {
        ...baseOpts.plugins,
        legend: { display: true, labels: { usePointStyle: true, pointStyleWidth: 7, padding: 10 } },
      },
      scales: {
        ...baseOpts.scales,
        y: { ...baseOpts.scales.y, ticks: { callback: v => v + '%' } },
      },
    },
  });
}

function buildReachChart(plats) {
  const id = 'chart-reach';
  destroyChart(id);
  const el = document.getElementById(id); if (!el) return;

  const dates = getDates();
  if (!dates.length) return;

  const labels   = dates.map(d => d.slice(5));
  const keys     = Object.keys(plats).filter(k => plats[k]);

  // Somme des likes et commentaires par date (toutes plateformes)
  const likes    = dates.map(d => keys.reduce((s, k) => s + (getValue(k, d, 'likes')    || 0), 0));
  const comments = dates.map(d => keys.reduce((s, k) => s + (getValue(k, d, 'comments') || 0), 0));

  ChartReg[id] = new Chart(el.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Likes',        data: likes,    backgroundColor: hexA('#6366F1', 0.75), borderRadius: 3, borderSkipped: false },
        { label: 'Commentaires', data: comments, backgroundColor: hexA('#22D3EE', 0.6),  borderRadius: 3, borderSkipped: false },
      ],
    },
    options: {
      ...baseOpts,
      plugins: {
        ...baseOpts.plugins,
        legend: { display: true, labels: { usePointStyle: true, pointStyleWidth: 7, padding: 10 } },
      },
    },
  });
}
