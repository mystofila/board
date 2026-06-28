/**
 * charts.js — Graphiques Chart.js
 */
Chart.defaults.color = 'rgba(248,250,252,0.5)';
Chart.defaults.font.family = 'Inter, sans-serif';
Chart.defaults.font.size = 11;

const ChartReg = {};

function destroyChart(id) { if(ChartReg[id]){ChartReg[id].destroy();delete ChartReg[id];} }

function hexA(hex,a) {
  if(!hex||!hex.startsWith('#')) return `rgba(99,102,241,${a})`;
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}
function grad(ctx,hex) {
  const g=ctx.createLinearGradient(0,0,0,200);
  g.addColorStop(0,hexA(hex,0.25)); g.addColorStop(1,hexA(hex,0.01)); return g;
}

const baseOpts = {
  responsive:true, maintainAspectRatio:false,
  interaction:{mode:'index',intersect:false},
  plugins:{
    legend:{display:false},
    tooltip:{backgroundColor:'rgba(26,26,36,0.95)',borderColor:'rgba(255,255,255,0.08)',borderWidth:1,cornerRadius:8,padding:10},
  },
  scales:{
    x:{grid:{color:'rgba(255,255,255,0.04)',drawBorder:false},border:{display:false},ticks:{maxTicksLimit:8,maxRotation:0}},
    y:{grid:{color:'rgba(255,255,255,0.04)',drawBorder:false},border:{display:false},ticks:{callback:v=>MockAPI.fmt(v)}},
  },
};

const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

function buildFollowersChart(plats) {
  const id='chart-followers'; destroyChart(id);
  const el=document.getElementById(id); if(!el) return;
  const ctx=el.getContext('2d');
  const entries=Object.entries(plats).filter(([,p])=>p&&p.followers);
  if(!entries.length) return;

  const datasets = entries.map(([key,p]) => {
    const now=p.followers||0;
    const data=Array.from({length:12},(_,i)=>Math.round(now*(0.72+(0.28*i/11))+(Math.random()-0.5)*now*0.015));
    data[11]=now;
    return { label:MockAPI.LABELS[key], data, borderColor:MockAPI.COLORS[key], backgroundColor:grad(ctx,MockAPI.COLORS[key]), borderWidth:2, pointRadius:0, tension:0.4, fill:true };
  });

  ChartReg[id]=new Chart(ctx,{type:'line',data:{labels:MONTHS,datasets},options:baseOpts});

  const leg=document.getElementById('followers-legend');
  if(leg) leg.innerHTML=entries.map(([k])=>`<div class="legend-item"><div class="legend-dot" style="background:${MockAPI.COLORS[k]}"></div>${MockAPI.LABELS[k]}</div>`).join('');
}

function buildDonutChart(plats) {
  const id='chart-donut'; destroyChart(id);
  const el=document.getElementById(id); if(!el) return;
  const entries=Object.entries(plats).filter(([,p])=>p&&p.followers);
  if(!entries.length) return;

  ChartReg[id]=new Chart(el.getContext('2d'),{
    type:'doughnut',
    data:{
      labels:entries.map(([k])=>MockAPI.LABELS[k]),
      datasets:[{data:entries.map(([,p])=>p.followers),backgroundColor:entries.map(([k])=>MockAPI.COLORS[k]),borderWidth:0,hoverOffset:5}]
    },
    options:{responsive:true,maintainAspectRatio:false,cutout:'70%',
      plugins:{legend:{position:'bottom',labels:{padding:12,usePointStyle:true,pointStyleWidth:7}},
        tooltip:{backgroundColor:'rgba(26,26,36,0.95)',borderColor:'rgba(255,255,255,0.08)',borderWidth:1,cornerRadius:8,callbacks:{label:ctx=>` ${MockAPI.fmt(ctx.raw)} abonnés`}}}},
  });
}

function buildEngagementChart(plats) {
  const id='chart-engagement'; destroyChart(id);
  const el=document.getElementById(id); if(!el) return;
  const entries=Object.entries(plats).filter(([,p])=>p&&p.engagement);
  if(!entries.length) return;

  const datasets=entries.map(([key,p])=>{
    const base=p.engagement||0;
    const data=Array.from({length:12},()=>parseFloat((base+(Math.random()-0.5)*0.6).toFixed(2)));
    data[11]=base;
    return {label:MockAPI.LABELS[key],data,borderColor:MockAPI.COLORS[key],backgroundColor:'transparent',borderWidth:2,pointRadius:0,tension:0.4};
  });

  ChartReg[id]=new Chart(el.getContext('2d'),{type:'line',data:{labels:MONTHS,datasets},
    options:{...baseOpts,plugins:{...baseOpts.plugins,legend:{display:true,labels:{usePointStyle:true,pointStyleWidth:7,padding:10}}},
      scales:{...baseOpts.scales,y:{...baseOpts.scales.y,ticks:{callback:v=>v+'%'}}}}});
}

function buildReachChart(plats) {
  const id='chart-reach'; destroyChart(id);
  const el=document.getElementById(id); if(!el) return;
  const entries=Object.entries(plats).filter(([,p])=>p&&p.views);
  if(!entries.length) return;

  const totalViews=entries.reduce((s,[,p])=>s+(p.views||0),0);
  const base=Math.round(totalViews/12);
  const reach=Array.from({length:12},()=>Math.round(base*(0.6+Math.random()*0.4)));
  const impr=reach.map(v=>Math.round(v*(1.2+Math.random()*0.3)));

  ChartReg[id]=new Chart(el.getContext('2d'),{type:'bar',
    data:{labels:MONTHS,datasets:[
      {label:'Portée',data:reach,backgroundColor:hexA('#6366F1',0.7),borderRadius:3,borderSkipped:false},
      {label:'Impressions',data:impr,backgroundColor:hexA('#22D3EE',0.5),borderRadius:3,borderSkipped:false},
    ]},
    options:{...baseOpts,plugins:{...baseOpts.plugins,legend:{display:true,labels:{usePointStyle:true,pointStyleWidth:7,padding:10}}}}});
}
