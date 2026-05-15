// Supabase connection
const SUPABASE_URL = 'https://bchvcxkocdlrkkzivuun.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaHZjeGtvY2Rscmtreml2dXVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyODA3NjksImV4cCI6MjA5Mjg1Njc2OX0.oyfzu_VNk9nZocRcq02JTmxdgQEi3BqclZEKgHwqF5U';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Clock
updateSideClock();
setInterval(updateSideClock, 1000);

// Chart expand/collapse
let expandedChart = null;

function expandChart(which) {
  if (expandedChart === which) return;
  expandedChart = which;
  const barPanel   = document.getElementById('barPanel');
  const donutPanel = document.getElementById('donutPanel');
  const barExp     = document.getElementById('barExpandBtn');
  const donutExp   = document.getElementById('donutExpandBtn');
  const barCol     = document.getElementById('barCollapseBtn');
  const donutCol   = document.getElementById('donutCollapseBtn');

  if (which === 'bar') {
    barPanel.classList.add('chart-expanded');
    donutPanel.classList.add('chart-shrunk');
    barExp.classList.add('hidden');
    barCol.classList.remove('hidden');
    donutExp.classList.remove('hidden');
    donutCol.classList.add('hidden');
  } else {
    donutPanel.classList.add('chart-expanded');
    barPanel.classList.add('chart-shrunk');
    donutExp.classList.add('hidden');
    donutCol.classList.remove('hidden');
    barExp.classList.remove('hidden');
    barCol.classList.add('hidden');
  }
  setTimeout(() => {
    barChartInst && barChartInst.resize();
    if (window._refreshDonutLayout) window._refreshDonutLayout();
  }, 420);
}

function collapseCharts() {
  expandedChart = null;
  const barPanel   = document.getElementById('barPanel');
  const donutPanel = document.getElementById('donutPanel');
  barPanel.classList.remove('chart-expanded', 'chart-shrunk');
  donutPanel.classList.remove('chart-expanded', 'chart-shrunk');
  document.getElementById('barExpandBtn').classList.remove('hidden');
  document.getElementById('barCollapseBtn').classList.add('hidden');
  document.getElementById('donutExpandBtn').classList.remove('hidden');
  document.getElementById('donutCollapseBtn').classList.add('hidden');
  if (window._pieResetOnCollapse) window._pieResetOnCollapse();
  setTimeout(() => {
    barChartInst && barChartInst.resize();
    if (window._refreshDonutLayout) window._refreshDonutLayout();
  }, 420);
}

const currency = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let ALL_YEARS   = [];
let ALL_TITHE   = [];
let ALL_OFFER   = [];
let ALL_TARGET  = [];
let WMC_MISSION_ID = null;

const valueLabelPlugin = {
  id: 'valueLabel',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((ds, di) => {
      chart.getDatasetMeta(di).data.forEach((bar, i) => {
        const val = ds.data[i];
        if (val == null) return;
        ctx.save();
        ctx.fillStyle = di === 0 ? '#3b82f6' : di === 1 ? '#d97706' : '#dc2626';
        ctx.font = '600 10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('₱' + (val / 1e6).toFixed(2) + 'M', bar.x, bar.y - 7);
        ctx.restore();
      });
    });
  }
};

let barChartInst = null;

function makeBarGradient(context, colorTop, colorBottom) {
  const { chart } = context;
  const { ctx, chartArea } = chart;
  if (!chartArea) return colorTop;
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, colorTop);
  gradient.addColorStop(1, colorBottom);
  return gradient;
}

function buildBarData(filter) {
  if (filter === 'all') return { labels: ALL_YEARS, tithe: ALL_TITHE, offer: ALL_OFFER, target: ALL_TARGET };
  const idx = ALL_YEARS.indexOf(filter);
  if (idx === -1) return { labels: ALL_YEARS, tithe: ALL_TITHE, offer: ALL_OFFER, target: ALL_TARGET };
  return { labels: [filter], tithe: [ALL_TITHE[idx]], offer: [ALL_OFFER[idx]], target: [ALL_TARGET[idx]] };
}

function updateCharts() {
  const filter = document.getElementById('yearSelect').value;
  const { labels, tithe, offer, target } = buildBarData(filter);
  const periodText = filter === 'all' ? `${ALL_YEARS[0]} – ${ALL_YEARS[ALL_YEARS.length - 1]}` : filter;
  document.getElementById('barPeriodLabel').textContent = periodText;

  if (barChartInst) {
    barChartInst.data.labels = labels;
    barChartInst.data.datasets[0].data = tithe;
    barChartInst.data.datasets[1].data = offer;
    barChartInst.data.datasets[2].data = target;
    barChartInst.update();
  }

  const idx = filter === 'all' ? ALL_YEARS.length - 1 : ALL_YEARS.indexOf(filter);
  const t = ALL_TITHE[idx], o = ALL_OFFER[idx], tg = ALL_TARGET[idx];
  document.getElementById('kpiTithe').textContent    = '₱' + currency.format(t);
  document.getElementById('kpiOffering').textContent = '₱' + currency.format(o);
  document.getElementById('kpiTarget').textContent   = '₱' + currency.format(tg);
  const variance = t - tg;
  const varEl = document.getElementById('kpiVariance');
  varEl.textContent = (variance >= 0 ? '+₱' : '-₱') + currency.format(Math.abs(variance));
  varEl.style.color = variance >= 0 ? '#6ee7b7' : '#fca5a5';
  document.getElementById('kpiCombined').textContent = '₱' + currency.format(t + o);
}

const barGlowPlugin = {
  id: 'barGlow',
  beforeDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((_, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;
      const glowColors = ['rgba(79,124,255,0.55)', 'rgba(245,158,11,0.50)', 'rgba(239,68,68,0.45)'];
      ctx.save();
      ctx.shadowColor = glowColors[datasetIndex] || 'rgba(255,255,255,0.35)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4;
      meta.data.forEach((bar) => bar.draw(ctx));
      ctx.restore();
    });
  }
};

// Donut chart
const PIE_COLORS = ['#4f7cff', '#f59e0b', '#facc15'];
const PIE_GLOW  = ['rgba(79,124,255,0.6)', 'rgba(245,158,11,0.6)', 'rgba(250,204,21,0.6)'];
const PIE_LABELS_TITHE = ['From Churches', 'From Workers', 'From Outside'];
const PIE_LABELS_OFFERING = ['Regular Offerings', 'Special Offerings', 'Thanksgiving'];
let currentSourceType = 'tithes';
const pieCanvas = document.getElementById('donutChart');
const pieWrap   = document.getElementById('wrap-pie');
let pieChartInst = null;
let pieYear = 2026;
let labelsVisible = false;

const cardsContainer = document.createElement('div');
cardsContainer.id = 'pieCards';
cardsContainer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:5;opacity:0;transition:opacity 0.4s ease;';
pieWrap.appendChild(cardsContainer);

function updateLabelCards() {
  const data  = pieChartInst.data.datasets[0].data;
  const total = data.reduce((a,b) => a+b, 0) || 1;
  const meta  = pieChartInst.getDatasetMeta(0);
  if (!meta.data.length) return;
  const area   = pieChartInst.chartArea;
  const cx     = (area.left + area.right) / 2;
  const cy     = (area.top  + area.bottom) / 2;
  const outerR = meta.data[0].outerRadius;
  const W      = pieWrap.clientWidth;
  const H      = pieWrap.clientHeight;

  const cardW = 168;
  const cardH = 90;
  const pad   = 10;

  const anchors = [
    { side: 'right', cx: W - pad - cardW / 2 - 130,  cy: H * 0.50 },
    { side: 'left',  cx: pad + cardW / 2 + 110,       cy: H * 0.25 },
    { side: 'left',  cx: pad + cardW / 2 + 110,       cy: H * 0.68 },
  ];

  cardsContainer.innerHTML = '';

  const labels = currentSourceType === 'tithes' ? PIE_LABELS_TITHE : PIE_LABELS_OFFERING;

  data.forEach((value, i) => {
    const pct   = ((value / total) * 100).toFixed(1);
    const money = '\u20b1' + (value / 1e6).toFixed(2) + 'M';
    const arc   = meta.data[i];
    const midAngle = (arc.startAngle + arc.endAngle) / 2;
    const lineStartX = cx + Math.cos(midAngle) * (outerR + 8);
    const lineStartY = cy + Math.sin(midAngle) * (outerR + 8);
    const a = anchors[i];

    const cardLeft = Math.max(pad, Math.min(W - cardW - pad, a.cx - cardW / 2));
    const cardTop  = Math.max(pad, Math.min(H - cardH - pad, a.cy - cardH / 2));

    const lineEndX = a.side === 'right' ? cardLeft : cardLeft + cardW;
    const lineEndY = cardTop + cardH / 2;

    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;';
    const cpX = (lineStartX + lineEndX) / 2;
    const cpY = Math.min(lineStartY, lineEndY) - 30;
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', `M${lineStartX},${lineStartY} Q${cpX},${cpY} ${lineEndX},${lineEndY}`);
    path.setAttribute('stroke', PIE_COLORS[i]);
    path.setAttribute('stroke-width', '1.8');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.style.filter = `drop-shadow(0 0 3px ${PIE_GLOW[i]})`;
    svg.appendChild(path);

    const dotS = document.createElementNS('http://www.w3.org/2000/svg','circle');
    dotS.setAttribute('cx', lineStartX); dotS.setAttribute('cy', lineStartY);
    dotS.setAttribute('r', '3.5'); dotS.setAttribute('fill', PIE_COLORS[i]);
    svg.appendChild(dotS);

    const dotE = document.createElementNS('http://www.w3.org/2000/svg','circle');
    dotE.setAttribute('cx', lineEndX); dotE.setAttribute('cy', lineEndY);
    dotE.setAttribute('r', '3.5'); dotE.setAttribute('fill', PIE_COLORS[i]);
    dotE.style.filter = `drop-shadow(0 0 5px ${PIE_GLOW[i]})`;
    svg.appendChild(dotE);
    cardsContainer.appendChild(svg);

    const card = document.createElement('div');
    card.style.cssText = `
      position:absolute;
      left:${cardLeft}px;
      top:${cardTop}px;
      width:${cardW}px;
      height:${cardH}px;
      background:rgba(8,16,60,0.88);
      border:1.5px solid ${PIE_COLORS[i]};
      border-radius:12px;
      padding:10px 14px;
      box-shadow:0 6px 24px rgba(0,0,0,0.5), 0 0 14px ${PIE_GLOW[i]};
      backdrop-filter:blur(10px);
      pointer-events:none;
      display:flex;
      flex-direction:column;
      justify-content:center;
      gap:4px;
      animation:cardFadeIn 0.45s ease forwards;
    `;
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="width:11px;height:11px;border-radius:50%;background:${PIE_COLORS[i]};flex-shrink:0;box-shadow:0 0 7px ${PIE_GLOW[i]};"></span>
        <span style="font-family:Montserrat,sans-serif;font-weight:800;font-size:0.72rem;letter-spacing:0.6px;color:rgba(255,255,255,0.9);white-space:nowrap;">${labels[i]}</span>
      </div>
      <div style="font-family:Montserrat,sans-serif;font-weight:900;font-size:1.65rem;color:${PIE_COLORS[i]};line-height:1;text-shadow:0 0 10px ${PIE_GLOW[i]};">${pct}%</div>
      <div style="font-family:Montserrat,sans-serif;font-weight:700;font-size:0.78rem;color:rgba(255,255,255,0.65);">${money}</div>
    `;
    cardsContainer.appendChild(card);
  });
}

function showPieLabels() {
  labelsVisible = true;
  updateLabelCards();
  requestAnimationFrame(() => { cardsContainer.style.opacity = '1'; });
}

function hidePieLabels() {
  labelsVisible = false;
  cardsContainer.style.opacity = '0';
}

let pulseT = 0;
const pulsePlugin = {
  id: 'pulseRing',
  afterDraw(chart) {
    const meta = chart.getDatasetMeta(0);
    if (!meta.data.length) return;
    const { ctx: c, chartArea } = chart;
    const cx     = (chartArea.left + chartArea.right) / 2;
    const cy     = (chartArea.top  + chartArea.bottom) / 2;
    const outerR = meta.data[0].outerRadius;
    pulseT = (pulseT + 0.018) % (Math.PI * 2);
    const r    = outerR * (1 + Math.sin(pulseT) * 0.012) + 6;
    const grad = c.createRadialGradient(cx, cy, r-4, cx, cy, r+4);
    grad.addColorStop(0,   'rgba(79,124,255,0.0)');
    grad.addColorStop(0.5, 'rgba(79,124,255,0.35)');
    grad.addColorStop(1,   'rgba(79,124,255,0.0)');
    c.save();
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.strokeStyle = grad;
    c.lineWidth   = 8;
    c.stroke();
    c.restore();
  }
};

const centerLabelPlugin = {
  id: 'centerLabel',
  afterDraw(chart) {
    const { ctx: c, chartArea } = chart;
    if (!chartArea) return;
    const total = chart.data.datasets[0].data.reduce((a,b) => a+b, 0);
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top  + chartArea.bottom) / 2;
    c.save();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.font = '700 11px Montserrat,sans-serif';
    const labelText = currentSourceType === 'tithes' ? 'TOTAL TITHE' : 'TOTAL OFFERINGS';
    c.fillText(labelText, cx, cy - 10);
    c.fillStyle = '#f5a623';
    c.shadowColor = 'rgba(245,166,35,0.8)';
    c.shadowBlur  = 10;
    c.font = '900 15px Montserrat,sans-serif';
    c.fillText('\u20b1' + (total/1e6).toFixed(2) + 'M', cx, cy + 8);
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(255,255,255,0.4)';
    c.font = '600 10px Montserrat,sans-serif';
    c.fillText(pieYear.toString(), cx, cy + 22);
    c.restore();
  }
};

function applyDonutViewportSettings() {
  if (!pieChartInst) return;
  const donutExpanded = document.getElementById('donutPanel').classList.contains('chart-expanded');
  if (donutExpanded) {
    pieChartInst.options.radius = '72%';
    pieChartInst.options.cutout = '42%';
    pieChartInst.options.layout.padding = { left: 170, right: 170, top: 16, bottom: 16 };
  } else {
    pieChartInst.options.radius = '84%';
    pieChartInst.options.cutout = '32%';
    pieChartInst.options.layout.padding = { left: 28, right: 28, top: 10, bottom: 10 };
  }
  pieChartInst.update('none');
}

window._refreshDonutLayout = function() {
  applyDonutViewportSettings();
  if (labelsVisible) updateLabelCards();
};
window._pieResetOnCollapse = function() {
  hidePieLabels();
  applyDonutViewportSettings();
};

function updateDonutChart() {
  currentSourceType = document.getElementById('sourceTypeSelect').value;
  
  if (currentSourceType === 'tithes') {
    document.getElementById('donutTitle').textContent = 'TITHE SOURCE BREAKDOWN';
  } else {
    document.getElementById('donutTitle').textContent = 'OFFERINGS SOURCE BREAKDOWN';
  }
  
  if (!pieChartInst) return;
  
  const latestYear = ALL_YEARS[ALL_YEARS.length - 1];
  const latestValue = currentSourceType === 'tithes' ? ALL_TITHE[ALL_TITHE.length - 1] : ALL_OFFER[ALL_OFFER.length - 1];
  pieYear = parseInt(latestYear);
  document.getElementById('donutYear').textContent = latestYear;
  
  let PIE_DATA;
  if (currentSourceType === 'tithes') {
    PIE_DATA = [
      latestValue * 0.921,
      latestValue * 0.028,
      latestValue * 0.051
    ];
  } else {
    PIE_DATA = [
      latestValue * 0.65,
      latestValue * 0.25,
      latestValue * 0.10
    ];
  }
  
  pieChartInst.data.labels = currentSourceType === 'tithes' ? PIE_LABELS_TITHE : PIE_LABELS_OFFERING;
  pieChartInst.data.datasets[0].data = PIE_DATA;
  pieChartInst.update();
  
  if (labelsVisible) {
    updateLabelCards();
  }
}

// Fetch WMC data from database
async function fetchWMCData() {
  try {
    const { data: mission, error: missionError } = await sb
      .from('missions')
      .select('id')
      .eq('code', 'WMC')
      .single();

    if (missionError || !mission) {
      console.error('Error fetching WMC mission:', missionError);
      initializeWithFallbackData();
      return;
    }

    WMC_MISSION_ID = mission.id;

    const { data: districts, error: districtError } = await sb
      .from('districts')
      .select('id')
      .eq('mission_id', WMC_MISSION_ID);

    if (districtError || !districts || districts.length === 0) {
      console.error('Error fetching districts:', districtError);
      initializeWithFallbackData();
      return;
    }

    const districtIds = districts.map(d => d.id);

    const { data: churches, error: churchError } = await sb
      .from('churches')
      .select('id')
      .in('district_id', districtIds);

    if (churchError || !churches || churches.length === 0) {
      console.error('Error fetching churches:', churchError);
      initializeWithFallbackData();
      return;
    }

    const churchIds = churches.map(c => c.id);

    const { data: tithes, error: titheError } = await sb
      .from('tithes')
      .select('year, month, amount, budget')
      .in('church_id', churchIds)
      .order('year', { ascending: true });

    const { data: offerings, error: offerError } = await sb
      .from('offerings')
      .select('year, month, amount, budget')
      .in('church_id', churchIds)
      .order('year', { ascending: true });

    if ((titheError && offerError) || (!tithes && !offerings)) {
      console.error('Error fetching data:', titheError, offerError);
      initializeWithFallbackData();
      return;
    }

    const yearlyData = {};

    if (tithes && tithes.length > 0) {
      tithes.forEach(t => {
        const year = String(t.year);
        if (!yearlyData[year]) {
          yearlyData[year] = { tithe: 0, offering: 0, target: 0 };
        }
        yearlyData[year].tithe += parseFloat(t.amount || 0);
        yearlyData[year].target += parseFloat(t.budget || 0);
      });
    }

    if (offerings && offerings.length > 0) {
      offerings.forEach(o => {
        const year = String(o.year);
        if (!yearlyData[year]) {
          yearlyData[year] = { tithe: 0, offering: 0, target: 0 };
        }
        yearlyData[year].offering += parseFloat(o.amount || 0);
      });
    }

    if (Object.keys(yearlyData).length === 0) {
      console.log('No data found, using fallback');
      initializeWithFallbackData();
      return;
    }

    const years = Object.keys(yearlyData).sort();
    ALL_YEARS = years;
    ALL_TITHE = years.map(y => yearlyData[y].tithe);
    ALL_OFFER = years.map(y => yearlyData[y].offering);
    ALL_TARGET = years.map(y => yearlyData[y].target > 0 ? yearlyData[y].target : 1440000000);

    console.log('Data loaded:', { years: ALL_YEARS, tithe: ALL_TITHE, offer: ALL_OFFER, target: ALL_TARGET });

    initializeCharts();
    updateCharts();

  } catch (error) {
    console.error('Error fetching WMC data:', error);
    initializeWithFallbackData();
  }
}

function initializeWithFallbackData() {
  ALL_YEARS = ['2022', '2023', '2024', '2025', '2026'];
  ALL_TITHE = [8252589.02, 9457675.66, 11130410.64, 11693864.40, 9825342.95];
  ALL_OFFER = [1089694.13, 1900086.56, 4054794.40, 6048374.90, 4189643.26];
  ALL_TARGET = [7000000, 8000000, 9000000, 10000000, 10000000];
  initializeCharts();
  updateCharts();
}

function initializeCharts() {
  const yearSelect = document.getElementById('yearSelect');
  yearSelect.innerHTML = '<option value="all">All Years</option>';
  ALL_YEARS.forEach(year => {
    yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
  });

  barChartInst = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels: ALL_YEARS,
      datasets: [
        {
          label: 'Tithe',
          data: ALL_TITHE,
          backgroundColor: (context) => makeBarGradient(context, 'rgba(111,159,255,0.97)', 'rgba(56,108,230,0.70)'),
          borderColor: '#9dc3ff',
          borderWidth: 1.2,
          borderRadius: 7,
          borderSkipped: false
        },
        {
          label: 'Offerings',
          data: ALL_OFFER,
          backgroundColor: (context) => makeBarGradient(context, 'rgba(251,191,36,0.95)', 'rgba(217,119,6,0.72)'),
          borderColor: '#ffd36a',
          borderWidth: 1.2,
          borderRadius: 7,
          borderSkipped: false
        },
        {
          label: 'Target',
          data: ALL_TARGET,
          backgroundColor: (context) => makeBarGradient(context, 'rgba(248,113,113,0.92)', 'rgba(220,38,38,0.66)'),
          borderColor: '#fca5a5',
          borderWidth: 1.2,
          borderRadius: 7,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 26, left: 6, right: 6, bottom: 4 } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: 'rgba(255,255,255,0.84)',
            callback: v => '₱' + (v/1e6).toFixed(1) + 'M',
            font: { size: 11, weight: '700' }
          },
          grid: { color: 'rgba(79,124,255,0.16)', borderDash: [4, 5] },
          border: { color: 'rgba(255,255,255,0.20)' }
        },
        x: {
          ticks: { color: '#fff', font: { size: 13, weight: '800' } },
          grid: { display: false },
          border: { color: 'rgba(255,255,255,0.20)' }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#fff',
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 10,
            boxHeight: 10,
            font: { size: 12, weight: '800' },
            padding: 18
          }
        },
        tooltip: {
          backgroundColor: 'rgba(10,20,80,0.92)',
          borderColor: 'rgba(255,255,255,0.2)',
          borderWidth: 1,
          titleColor: '#f5a623',
          bodyColor: '#fff',
          padding: 10,
          callbacks: { label: ctx => `${ctx.dataset.label}: ₱${currency.format(ctx.parsed.y)}` }
        }
      }
    },
    plugins: [valueLabelPlugin, barGlowPlugin]
  });

  const latestYear = ALL_YEARS[ALL_YEARS.length - 1];
  const latestTithe = ALL_TITHE[ALL_TITHE.length - 1];
  pieYear = parseInt(latestYear);
  document.getElementById('donutYear').textContent = latestYear;
  
  const PIE_DATA = [
    latestTithe * 0.921,
    latestTithe * 0.028,
    latestTithe * 0.051
  ];

  pieChartInst = new Chart(pieCanvas.getContext('2d'), {
    type: 'doughnut',
    plugins: [pulsePlugin, centerLabelPlugin],
    data: {
      labels: PIE_LABELS_TITHE,
      datasets: [{
        data: PIE_DATA,
        backgroundColor: PIE_COLORS,
        borderColor: PIE_GLOW,
        borderWidth: 2.5,
        hoverOffset: 10,
        hoverBorderWidth: 3,
        hoverBorderColor: '#fff'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      radius: '84%', cutout: '32%',
      layout: { padding: { left: 28, right: 28, top: 10, bottom: 10 } },
      animation: { duration: 500, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10,20,80,0.92)',
          borderColor: 'rgba(255,255,255,0.2)', borderWidth: 1,
          titleColor: '#f5a623', bodyColor: '#fff', padding: 10,
          callbacks: { label: ctx => ` ${ctx.label}: \u20b1${ctx.parsed.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}` }
        }
      }
    }
  });

  (function animatePulse() {
    if (pieChartInst) { pieChartInst.draw(); requestAnimationFrame(animatePulse); }
  })();

  new ResizeObserver(() => {
    if (pieChartInst) pieChartInst.resize();
    if (labelsVisible) updateLabelCards();
  }).observe(pieWrap);

  pieWrap.addEventListener('click', e => {
    if (e.target.closest('button')) return;
    const donutPanel = document.getElementById('donutPanel');
    if (!donutPanel.classList.contains('chart-expanded')) {
      expandChart('donut');
      setTimeout(() => showPieLabels(), 450);
    } else {
      hidePieLabels();
      setTimeout(() => collapseCharts(), 300);
    }
  });

  applyDonutViewportSettings();
}

fetchWMCData();
