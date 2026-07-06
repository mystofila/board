/**
 * charts.js — Graphiques basés sur history.json
 */
Chart.defaults.color = 'rgba(248,250,252,0.5)';
Chart.defaults.font.family = 'Inter, sans-serif';
Chart.defaults.font.size = 11;

const ChartReg = {};

function destroyChart(id) { if (ChartReg[id]) { ChartReg[id].destroy(); delete ChartReg[id]; } }

function hexA(hex, a) {
  if (!hex || !hex.startsWith('#')) return `rgba(99,102,241,${a})`;
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function grad(ctx, hex) {
  const g = ctx.createLinearGradient(0, 0, 0, 200);
  g.addColorStop(0, hexA(hex, 0.3));
  g.addColorStop(1, hexA(hex, 0.01));
  return g;
}

const baseOpts = {
  responsive: true, maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: 'rgba(26,26,36,0.95)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, cornerRadius: 8, padding: 10 },
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false }, border: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0 } },
    y: { grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false }, border: { display: false }, ticks: { callback: v => MockAPI.fmt(v) } },
  },
};

// Extraire les données historiques par plateforme depuis _raw
function getHistorySeries(platformKey, field) {
  const entries = MockAPI._raw
    .filter(e => e.platform === platformKey)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  return {
    labels: entries.map(e => e.date ? e.date.slice(5) : ''), // MM-DD
    values: entries.map(e => e[field] || 0),
  };
}

function buildFollowersChart(plats) {
  const id = 'chart-followers'; destroyChart(id);
  const el = document.getElementById(id); if (!el) return;
  const ctx = el.getContext('2d');

  const entries = Object.entries(plats).filter(([, p]) => p != null);
  if (!entries.length) return;

  // Utiliser le vrai historique si dispo, sinon juste le point actuel
  const allDates = [...new Set(MockAPI._raw.map(e => e.date).filter(Boolean))].sort();
  const labels   = allDates.length > 1 ? allDates.map(d => d.slice(5)) : ['Actuel'];

  const datasets = entries.map(([key, p]) => {
    let values;
    if (allDates.length > 1) {
      values = allDates.map(date => {
        const e = MockAPI._raw.find(r => r.platform === key && r.date === date);
        return e ? (e.followers || 0) : null;
      });
    } else {
      values = [p.followers || 0];
    }
    return {
      label: MockAPI.LABELS[key],
      data: values,
      borderColor: MockAPI.COLORS[key],
      backgroundColor: grad(ctx, MockAPI.COLORS[key]),
      borderWidth: 2, pointRadius: allDates.length > 1 ? 3 : 5,
      pointBackgroundColor: MockAPI.COLORS[key],
      tension: 0.4, fill: true, spanGaps: true,
    };
  });

  ChartReg[id] = new Chart(ctx, { type: 'line', data: { labels, datasets }, options: baseOpts });

  const leg = document.getElementById('followers-legend');
  if (leg) leg.innerHTML = entries.map(([k]) =>
    `<div class="legend-item"><div class="legend-dot" style="background:${MockAPI.COLORS[k]}"></div>${MockAPI.LABELS[k]}</div>`
  ).join('');
}

function buildDonutChart(plats) {
  const id = 'chart-donut'; destroyChart(id);
  const el = document.getElementById(id); if (!el) return;
  const entries = Object.entries(plats).filter(([, p]) => p != null);
  if (!entries.length) return;

  ChartReg[id] = new Chart(el.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels:   entries.map(([k]) => MockAPI.LABELS[k]),
      datasets: [{ data: entries.map(([, p]) => p.followers), backgroundColor: entries.map(([k]) => MockAPI.COLORS[k]), borderWidth: 0, hoverOffset: 5 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '70%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 7 } },
        tooltip: { backgroundColor: 'rgba(26,26,36,0.95)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, cornerRadius: 8,
          callbacks: { label: ctx => ` ${MockAPI.fmt(ctx.raw)} abonnés` } },
      },
    },
  });
}

function buildEngagementChart(plats) {
  const id = 'chart-engagement'; destroyChart(id);
  const el = document.getElementById(id); if (!el) return;
  const entries = Object.entries(plats).filter(([, p]) => p != null);
  if (!entries.length) return;

  const allDates = [...new Set(MockAPI._raw.map(e => e.date).filter(Boolean))].sort();
  const labels   = allDates.length > 1 ? allDates.map(d => d.slice(5)) : ['Actuel'];

  const datasets = entries.map(([key, p]) => {
    const values = allDates.length > 1
      ? allDates.map(date => { const e = MockAPI._raw.find(r => r.platform === key && r.date === date); return e ? (e.engagement || 0) : null; })
      : [p.engagement || 0];
    return { label: MockAPI.LABELS[key], data: values, borderColor: MockAPI.COLORS[key], backgroundColor: 'transparent', borderWidth: 2, pointRadius: 2, tension: 0.4, spanGaps: true };
  });

  ChartReg[id] = new Chart(el.getContext('2d'), {
    type: 'line', data: { labels, datasets },
    options: { ...baseOpts,
      plugins: { ...baseOpts.plugins, legend: { display: true, labels: { usePointStyle: true, pointStyleWidth: 7, padding: 10 } } },
      scales:  { ...baseOpts.scales, y: { ...baseOpts.scales.y, ticks: { callback: v => v + '%' } } },
    },
  });
}

function buildReachChart(plats) {
  const id = 'chart-reach'; destroyChart(id);
  const el = document.getElementById(id); if (!el) return;
  const entries = Object.entries(plats).filter(([, p]) => p != null);
  if (!entries.length) return;

  const allDates = [...new Set(MockAPI._raw.map(e => e.date).filter(Boolean))].sort();
  const labels   = allDates.length > 1 ? allDates.map(d => d.slice(5)) : ['Actuel'];

  // Somme des likes comme proxy de portée
  const likes    = allDates.map(date => MockAPI._raw.filter(r => r.date === date).reduce((s, r) => s + (r.likes || 0), 0));
  const comments = allDates.map(date => MockAPI._raw.filter(r => r.date === date).reduce((s, r) => s + (r.comments || 0), 0));

  ChartReg[id] = new Chart(el.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Likes',       data: likes,    backgroundColor: hexA('#6366F1', 0.75), borderRadius: 3, borderSkipped: false },
      { label: 'Commentaires',data: comments, backgroundColor: hexA('#22D3EE', 0.6),  borderRadius: 3, borderSkipped: false },
    ]},
    options: { ...baseOpts, plugins: { ...baseOpts.plugins, legend: { display: true, labels: { usePointStyle: true, pointStyleWidth: 7, padding: 10 } } } },
  });
}
