const currency = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SUPABASE_URL  = 'https://bchvcxkocdlrkkzivuun.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaHZjeGtvY2Rscmtreml2dXVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyODA3NjksImV4cCI6MjA5Mjg1Njc2OX0.oyfzu_VNk9nZocRcq02JTmxdgQEi3BqclZEKgHwqF5U';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

let WMC_MISSION_ID = null;
let DISTRICTS_DATA = [];
let CHURCHES_DATA  = [];
let TITHES_DATA    = [];
let OFFERINGS_DATA = [];

async function fetchWMCData() {
  try {
    const { data: mission, error: missionError } = await sb
      .from('missions').select('id').eq('code', 'WMC').single();

    if (missionError || !mission) { console.error('Mission error:', missionError); return; }
    WMC_MISSION_ID = mission.id;

    const { data: districts, error: districtError } = await sb
      .from('districts').select('id, name, leader_name')
      .eq('mission_id', WMC_MISSION_ID).order('name');

    if (districtError) { console.error('Districts error:', districtError); return; }
    DISTRICTS_DATA = districts || [];

    const districtIds = DISTRICTS_DATA.map(d => d.id);

    const { data: churches, error: churchError } = await sb
      .from('churches').select('id, district_id, name')
      .in('district_id', districtIds).order('name');

    if (!churchError && churches) CHURCHES_DATA = churches;

    const churchIds = CHURCHES_DATA.map(c => c.id);

    const { data: tithes, error: titheError } = await sb
      .from('tithes').select('church_id, year, amount')
      .in('church_id', churchIds).in('year', [2025, 2026]);

    if (!titheError && tithes) TITHES_DATA = tithes;

    const { data: offerings, error: offerError } = await sb
      .from('offerings').select('church_id, year, amount')
      .in('church_id', churchIds).in('year', [2025, 2026]);

    if (!offerError && offerings) OFFERINGS_DATA = offerings;

    renderTables();
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

function renderTables() {
  const tithesBody    = document.getElementById('tithesTableBody');
  const offeringsBody = document.getElementById('offeringsTableBody');

  if (DISTRICTS_DATA.length === 0) {
    tithesBody.innerHTML    = '<tr><td colspan="7" style="text-align:center;padding:20px;">No data available</td></tr>';
    offeringsBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">No data available</td></tr>';
    return;
  }

  const districtTithes    = {};
  const districtOfferings = {};

  DISTRICTS_DATA.forEach(d => {
    districtTithes[d.id]    = { name: d.name, y2025: 0, y2026: 0, churches: 0 };
    districtOfferings[d.id] = { name: d.name, y2025: 0, y2026: 0 };
  });

  CHURCHES_DATA.forEach(c => {
    if (districtTithes[c.district_id]) districtTithes[c.district_id].churches++;
  });

  TITHES_DATA.forEach(t => {
    const church = CHURCHES_DATA.find(c => c.id === t.church_id);
    if (!church || !districtTithes[church.district_id]) return;
    if (t.year === 2025) districtTithes[church.district_id].y2025 += parseFloat(t.amount || 0);
    else if (t.year === 2026) districtTithes[church.district_id].y2026 += parseFloat(t.amount || 0);
  });

  OFFERINGS_DATA.forEach(o => {
    const church = CHURCHES_DATA.find(c => c.id === o.church_id);
    if (!church || !districtOfferings[church.district_id]) return;
    if (o.year === 2025) districtOfferings[church.district_id].y2025 += parseFloat(o.amount || 0);
    else if (o.year === 2026) districtOfferings[church.district_id].y2026 += parseFloat(o.amount || 0);
  });

  tithesBody.innerHTML = Object.values(districtTithes).map((d, i) => {
    const v = d.y2026 - d.y2025;
    const p = d.y2025 > 0 ? ((v / d.y2025) * 100).toFixed(0) : 0;
    const vc = v >= 0 ? 'pos' : 'neg';
    const pc = p >= 0 ? 'pos' : 'neg';
    return `<tr>
      <td>${i + 1}</td>
      <td class="district">${d.name}</td>
      <td>${currency.format(d.y2026)}</td>
      <td>${currency.format(d.y2025)}</td>
      <td class="${vc}">${v >= 0 ? '' : '('}${currency.format(Math.abs(v))}${v >= 0 ? '' : ')'}</td>
      <td class="${pc}">${p >= 0 ? '' : '('}${Math.abs(p)}%${p >= 0 ? '' : ')'}</td>
      <td><button class="church-count-btn" onclick="openChurchModal('${d.name.replace(/'/g, "\\'")}')">${d.churches}</button></td>
    </tr>`;
  }).join('');

  offeringsBody.innerHTML = Object.values(districtOfferings).map((d, i) => {
    const v = d.y2026 - d.y2025;
    const p = d.y2025 > 0 ? ((v / d.y2025) * 100).toFixed(0) : 0;
    const vc = v >= 0 ? 'pos' : 'neg';
    const pc = p >= 0 ? 'pos' : 'neg';
    return `<tr>
      <td>${i + 1}</td>
      <td class="district">${d.name}</td>
      <td>${currency.format(d.y2026)}</td>
      <td>${currency.format(d.y2025)}</td>
      <td class="${vc}">${v >= 0 ? '' : '('}${currency.format(Math.abs(v))}${v >= 0 ? '' : ')'}</td>
      <td class="${pc}">${p >= 0 ? '' : '('}${Math.abs(p)}%${p >= 0 ? '' : ')'}</td>
    </tr>`;
  }).join('');

  // Tithes tfoot totals
  const tT26 = Object.values(districtTithes).reduce((s, d) => s + d.y2026, 0);
  const tT25 = Object.values(districtTithes).reduce((s, d) => s + d.y2025, 0);
  const tV   = tT26 - tT25;
  const tP   = tT25 > 0 ? ((tV / tT25) * 100).toFixed(0) : 0;
  const tC   = Object.values(districtTithes).reduce((s, d) => s + d.churches, 0);
  const tVC  = tV >= 0 ? 'pos' : 'neg';
  document.getElementById('tfootTithe2026').textContent     = currency.format(tT26);
  document.getElementById('tfootTithe2025').textContent     = currency.format(tT25);
  document.getElementById('tfootTitheVariance').className   = tVC;
  document.getElementById('tfootTitheVariance').textContent = (tV >= 0 ? '' : '(') + currency.format(Math.abs(tV)) + (tV >= 0 ? '' : ')');
  document.getElementById('tfootTithePct').className        = tVC;
  document.getElementById('tfootTithePct').textContent      = (tP >= 0 ? '' : '(') + Math.abs(tP) + '%' + (tP >= 0 ? '' : ')');
  document.getElementById('tfootTitheChurches').textContent = tC;

  // Offerings tfoot totals
  const oT26 = Object.values(districtOfferings).reduce((s, d) => s + d.y2026, 0);
  const oT25 = Object.values(districtOfferings).reduce((s, d) => s + d.y2025, 0);
  const oV   = oT26 - oT25;
  const oP   = oT25 > 0 ? ((oV / oT25) * 100).toFixed(0) : 0;
  const oVC  = oV >= 0 ? 'pos' : 'neg';
  document.getElementById('tfootOffer2026').textContent     = currency.format(oT26);
  document.getElementById('tfootOffer2025').textContent     = currency.format(oT25);
  document.getElementById('tfootOfferVariance').className   = oVC;
  document.getElementById('tfootOfferVariance').textContent = (oV >= 0 ? '' : '(') + currency.format(Math.abs(oV)) + (oV >= 0 ? '' : ')');
  document.getElementById('tfootOfferPct').className        = oVC;
  document.getElementById('tfootOfferPct').textContent      = (oP >= 0 ? '' : '(') + Math.abs(oP) + '%' + (oP >= 0 ? '' : ')');
}

function setTableTab(tab) {
  const tithesActive = tab === 'tithes';
  document.getElementById('tithesTableWrap').classList.toggle('active', tithesActive);
  document.getElementById('offeringsTableWrap').classList.toggle('active', !tithesActive);
  document.getElementById('tabTithes').classList.toggle('active', tithesActive);
  document.getElementById('tabOfferings').classList.toggle('active', !tithesActive);
}

function formatCurrencyValue(value) {
  return '₱' + currency.format(value);
}

function formatDeltaValue(value) {
  return (value >= 0 ? '+' : '-') + '₱' + currency.format(Math.abs(value));
}

function openChurchModal(districtName) {
  const district = DISTRICTS_DATA.find(d => d.name === districtName);
  if (!district) return;

  const districtChurches = CHURCHES_DATA.filter(c => c.district_id === district.id);
  document.getElementById('churchModalTitle').textContent    = `${districtName} District Profile`;
  document.getElementById('churchModalSubtitle').textContent = `${districtChurches.length} churches`;
  document.getElementById('churchProfileName').textContent   = districtName;
  document.getElementById('churchProfileAvatar').textContent = districtName.charAt(0).toUpperCase();

  setChurchModalTab('tithes');
  document.getElementById('churchModalOverlay').classList.remove('hidden');
  document.getElementById('churchModal').classList.remove('hidden');
}

function renderChurchModalTable(tab) {
  const districtName = document.getElementById('churchProfileName').textContent;
  const district     = DISTRICTS_DATA.find(d => d.name === districtName);
  if (!district) return;

  const districtChurches = CHURCHES_DATA.filter(c => c.district_id === district.id);
  const data = tab === 'tithes' ? TITHES_DATA : OFFERINGS_DATA;

  document.getElementById('churchModalTableBody').innerHTML = districtChurches.map(church => {
    const y25 = data.filter(d => d.church_id === church.id && d.year === 2025)
      .reduce((s, d) => s + parseFloat(d.amount || 0), 0);
    const y26 = data.filter(d => d.church_id === church.id && d.year === 2026)
      .reduce((s, d) => s + parseFloat(d.amount || 0), 0);
    const v   = y26 - y25;
    const p   = y25 > 0 ? ((v / y25) * 100) : 0;
    return `<tr>
      <td class="church-name-cell">${church.name}</td>
      <td>${formatCurrencyValue(y25)}</td>
      <td>${formatCurrencyValue(y26)}</td>
      <td class="${p >= 0 ? 'pos' : 'neg'}">${p >= 0 ? '+' : ''}${p.toFixed(1)}%</td>
      <td class="${v >= 0 ? 'pos' : 'neg'}">${formatDeltaValue(v)}</td>
    </tr>`;
  }).join('');
}

function setChurchModalTab(tab) {
  const isTithes = tab === 'tithes';
  document.getElementById('churchModalTabTithes').classList.toggle('active', isTithes);
  document.getElementById('churchModalTabOfferings').classList.toggle('active', !isTithes);
  renderChurchModalTable(tab);
}

function closeChurchModal() {
  document.getElementById('churchModalOverlay').classList.add('hidden');
  document.getElementById('churchModal').classList.add('hidden');
}

fetchWMCData();
