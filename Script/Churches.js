const currency = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Supabase connection
const SUPABASE_URL = 'https://bchvcxkocdlrkkzivuun.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaHZjeGtvY2Rscmtreml2dXVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyODA3NjksImV4cCI6MjA5Mjg1Njc2OX0.oyfzu_VNk9nZocRcq02JTmxdgQEi3BqclZEKgHwqF5U';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

let WMC_MISSION_ID = null;
let DISTRICTS_DATA = [];
let CHURCHES_DATA = [];
let TITHES_DATA = [];
let OFFERINGS_DATA = [];

async function fetchWMCData() {
  try {
    const { data: mission, error: missionError } = await sb
      .from('missions')
      .select('id')
      .eq('code', 'WMC')
      .single();

    if (missionError || !mission) {
      console.error('Error fetching WMC mission:', missionError);
      return;
    }

    WMC_MISSION_ID = mission.id;

    const { data: districts, error: districtError } = await sb
      .from('districts')
      .select('id, name, leader_name')
      .eq('mission_id', WMC_MISSION_ID)
      .order('name');

    if (districtError) {
      console.error('Error fetching districts:', districtError);
      return;
    }

    DISTRICTS_DATA = districts || [];
    const districtIds = DISTRICTS_DATA.map(d => d.id);

    const { data: churches, error: churchError } = await sb
      .from('churches')
      .select('id, district_id, name')
      .in('district_id', districtIds)
      .order('name');

    if (!churchError && churches) {
      CHURCHES_DATA = churches;
    }

    const churchIds = CHURCHES_DATA.map(c => c.id);

    const { data: tithes, error: titheError } = await sb
      .from('tithes')
      .select('church_id, year, amount')
      .in('church_id', churchIds)
      .in('year', [2025, 2026]);

    if (!titheError && tithes) {
      TITHES_DATA = tithes;
    }

    const { data: offerings, error: offerError } = await sb
      .from('offerings')
      .select('church_id, year, amount')
      .in('church_id', churchIds)
      .in('year', [2025, 2026]);

    if (!offerError && offerings) {
      OFFERINGS_DATA = offerings;
    }

    renderTables();

  } catch (error) {
    console.error('Error fetching WMC data:', error);
  }
}

function renderTables() {
  const tithesBody = document.getElementById('tithesTableBody');
  const offeringsBody = document.getElementById('offeringsTableBody');

  if (DISTRICTS_DATA.length === 0) {
    tithesBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">No data available</td></tr>';
    offeringsBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">No data available</td></tr>';
    return;
  }

  const districtTithes = {};
  const districtOfferings = {};

  DISTRICTS_DATA.forEach(district => {
    districtTithes[district.id] = { name: district.name, y2025: 0, y2026: 0, churches: 0 };
    districtOfferings[district.id] = { name: district.name, y2025: 0, y2026: 0 };
  });

  CHURCHES_DATA.forEach(church => {
    if (districtTithes[church.district_id]) {
      districtTithes[church.district_id].churches++;
    }
  });

  TITHES_DATA.forEach(t => {
    const church = CHURCHES_DATA.find(c => c.id === t.church_id);
    if (church && districtTithes[church.district_id]) {
      if (t.year === 2025) {
        districtTithes[church.district_id].y2025 += parseFloat(t.amount || 0);
      } else if (t.year === 2026) {
        districtTithes[church.district_id].y2026 += parseFloat(t.amount || 0);
      }
    }
  });

  OFFERINGS_DATA.forEach(o => {
    const church = CHURCHES_DATA.find(c => c.id === o.church_id);
    if (church && districtOfferings[church.district_id]) {
      if (o.year === 2025) {
        districtOfferings[church.district_id].y2025 += parseFloat(o.amount || 0);
      } else if (o.year === 2026) {
        districtOfferings[church.district_id].y2026 += parseFloat(o.amount || 0);
      }
    }
  });

  tithesBody.innerHTML = Object.values(districtTithes).map((district, index) => {
    const variance = district.y2026 - district.y2025;
    const variancePct = district.y2025 > 0 ? ((variance / district.y2025) * 100).toFixed(0) : 0;
    const varianceClass = variance >= 0 ? 'pos' : 'neg';
    const pctClass = variancePct >= 0 ? 'pos' : 'neg';
    
    return `<tr>
      <td>${index + 1}</td>
      <td class="district">${district.name}</td>
      <td>${currency.format(district.y2026)}</td>
      <td>${currency.format(district.y2025)}</td>
      <td class="${varianceClass}">${variance >= 0 ? '' : '('}${currency.format(Math.abs(variance))}${variance >= 0 ? '' : ')'}</td>
      <td class="${pctClass}">${variancePct >= 0 ? '' : '('}${Math.abs(variancePct)}%${variancePct >= 0 ? '' : ')'}</td>
      <td><button class="church-count-btn" onclick="openChurchModal('${district.name.replace(/'/g, "\\'")}')">${district.churches}</button></td>
    </tr>`;
  }).join('');

  offeringsBody.innerHTML = Object.values(districtOfferings).map((district, index) => {
    const variance = district.y2026 - district.y2025;
    const variancePct = district.y2025 > 0 ? ((variance / district.y2025) * 100).toFixed(0) : 0;
    const varianceClass = variance >= 0 ? 'pos' : 'neg';
    const pctClass = variancePct >= 0 ? 'pos' : 'neg';
    
    return `<tr>
      <td>${index + 1}</td>
      <td class="district">${district.name}</td>
      <td>${currency.format(district.y2026)}</td>
      <td>${currency.format(district.y2025)}</td>
      <td class="${varianceClass}">${variance >= 0 ? '' : '('}${currency.format(Math.abs(variance))}${variance >= 0 ? '' : ')'}</td>
      <td class="${pctClass}">${variancePct >= 0 ? '' : '('}${Math.abs(variancePct)}%${variancePct >= 0 ? '' : ')'}</td>
    </tr>`;
  }).join('');
}

function setTableTab(tab) {
  const tithesWrap = document.getElementById('tithesTableWrap');
  const offeringsWrap = document.getElementById('offeringsTableWrap');
  const tabTithes = document.getElementById('tabTithes');
  const tabOfferings = document.getElementById('tabOfferings');

  const tithesActive = tab === 'tithes';
  tithesWrap.classList.toggle('active', tithesActive);
  offeringsWrap.classList.toggle('active', !tithesActive);
  tabTithes.classList.toggle('active', tithesActive);
  tabOfferings.classList.toggle('active', !tithesActive);
}

function formatCurrencyValue(value) {
  return '₱' + currency.format(value);
}

function formatDeltaValue(value) {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}₱${currency.format(Math.abs(value))}`;
}

function openChurchModal(districtName) {
  const district = DISTRICTS_DATA.find(d => d.name === districtName);
  
  if (!district) {
    console.error('District not found:', districtName);
    return;
  }

  const districtChurches = CHURCHES_DATA.filter(c => c.district_id === district.id);
  const churchCount = districtChurches.length;

  document.getElementById('churchModalTitle').textContent = `${districtName} District Profile`;
  document.getElementById('churchModalSubtitle').textContent = `${churchCount} churches`;
  document.getElementById('churchModalSubtitle').dataset.count = String(churchCount);
  document.getElementById('churchProfileName').textContent = districtName;
  document.getElementById('churchProfileAvatar').textContent = districtName.charAt(0).toUpperCase();
  
  setChurchModalTab('tithes');
  document.getElementById('churchModalOverlay').classList.remove('hidden');
  document.getElementById('churchModal').classList.remove('hidden');
}

function renderChurchModalTable(tab) {
  const districtName = document.getElementById('churchProfileName').textContent;
  const district = DISTRICTS_DATA.find(d => d.name === districtName);
  
  if (!district) return;

  const districtChurches = CHURCHES_DATA.filter(c => c.district_id === district.id);
  const body = document.getElementById('churchModalTableBody');
  
  const data = tab === 'tithes' ? TITHES_DATA : OFFERINGS_DATA;
  
  body.innerHTML = districtChurches.map((church) => {
    const church2025 = data.filter(d => d.church_id === church.id && d.year === 2025)
      .reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
    const church2026 = data.filter(d => d.church_id === church.id && d.year === 2026)
      .reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
    
    const variance = church2026 - church2025;
    const variancePct = church2025 > 0 ? ((variance / church2025) * 100) : 0;
    const varianceClass = variancePct >= 0 ? 'pos' : 'neg';
    const deltaClass = variance >= 0 ? 'pos' : 'neg';
    
    return `<tr>
      <td class="church-name-cell">${church.name}</td>
      <td>${formatCurrencyValue(church2025)}</td>
      <td>${formatCurrencyValue(church2026)}</td>
      <td class="${varianceClass}">${variancePct >= 0 ? '+' : ''}${variancePct.toFixed(1)}%</td>
      <td class="${deltaClass}">${formatDeltaValue(variance)}</td>
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
