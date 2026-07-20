// === NAVIGATION ===
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  const titles = {
    dashboard:'📊 Dashboard Tổng quan', vehicles:'🚛 Thông tin xe', schedule:'📋 Lịch Tải',
    fines:'🚨 Phạt Nguội', efficiency:'📊 Hiệu suất xe', staff:'👥 Nhân sự',
    reinforcement:'📦 Tăng cường Lấy', ontime:'⏱️ Ontime xe tải', btbd:'🔧 Bảo trì - Sửa chữa (BTBD)'
  };
  document.getElementById('pageTitle').textContent = titles[page] || '';
  if (page === 'dashboard' && !window._dashChartsRendered) { renderDashboardCharts(); window._dashChartsRendered = true; }
  if (page === 'efficiency' && !window._effChartsRendered) { renderEfficiencyCharts(); window._effChartsRendered = true; }
  if (page === 'staff' && !window._staffChartsRendered) { renderStaffCharts(); window._staffChartsRendered = true; }
  if (page === 'ontime' && !window._ontimeChartsRendered) { renderOntimeCharts(); window._ontimeChartsRendered = true; }
  if (page === 'btbd' && !window._btbdChartsRendered) { renderBTBDCharts(); window._btbdChartsRendered = true; }
}

// === CLOCK ===
function updateClock() {
  const now = new Date();
  document.getElementById('headerTime').textContent = now.toLocaleString('vi-VN', {
    weekday:'long', day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit', second:'2-digit'
  });
}
setInterval(updateClock, 1000); updateClock();

// === SECURITY HELPERS ===
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// === HELPERS ===
function fmt(n) { return new Intl.NumberFormat('vi-VN').format(Math.round(n)); }
function fmtM(n) { return (n/1000000).toFixed(1) + 'M'; }
function parseCost(v) { if (typeof v === 'number') return v; if (typeof v === 'string') { const c = v.replace(/[^0-9]/g, ''); return c ? parseInt(c, 10) : 0; } return 0; }
Chart.defaults.color = '#555770';
Chart.defaults.borderColor = 'rgba(0,0,0,0.06)';
Chart.defaults.font.family = 'Inter';
const CHART_COLORS = ['#ee4d2d','#f26522','#22c55e','#f59e0b','#8b5cf6','#0891b2','#ef4444','#ec4899'];

function isExpiringSoon(dateStr) {
  if (!dateStr || dateStr === 'hết hạn') return dateStr === 'hết hạn' ? 'expired' : null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const now = new Date();
  const diff = (d - now) / (1000*60*60*24);
  if (diff < 0) return 'expired';
  if (diff < 30) return 'critical';
  if (diff < 90) return 'warning';
  return 'ok';
}

function dateCell(dateStr) {
  const st = isExpiringSoon(dateStr);
  if (!dateStr) return '<td>-</td>';
  if (dateStr === 'hết hạn') return '<td><span class="status breakdown">Hết hạn</span></td>';
  const cls = st === 'expired' ? 'breakdown' : st === 'critical' ? 'delayed' : st === 'warning' ? 'unassigned' : 'completed';
  const label = st === 'expired' ? '⛔' : st === 'critical' ? '🔴' : st === 'warning' ? '🟡' : '🟢';
  return `<td>${label} ${escapeHTML(dateStr)}</td>`;
}

function makeKPI(cards) {
  return cards.map(c =>
    `<div class="kpi-card ${escapeHTML(c.c)}"><div class="kpi-header"><div><div class="kpi-label">${escapeHTML(c.l)}</div><div class="kpi-value">${escapeHTML(c.v)}</div></div><div class="kpi-icon">${escapeHTML(c.i)}</div></div></div>`
  ).join('');
}

function populateSelect(id, values) {
  const sel = document.getElementById(id);
  if (sel.options.length <= 1) values.forEach(v => { const o = document.createElement('option'); o.value=v; o.textContent=v; sel.appendChild(o); });
}

// ==================== PAGE 0: DASHBOARD TỔNG QUAN ====================
function renderDashboard() {
  const v = DATA.vehicles;
  const d = DATA.drivers;
  const r = DATA.routes;
  const f = DATA.fines;
  const e = DATA.efficiency;
  const rf = DATA.reinforcement;

  const activeVehicles = v.filter(x => x.status === 'Hoạt động').length;
  const workingDrivers = d.filter(x => x.status === 'Đang làm việc').length;
  const uniqueRoutes = new Set(r.map(x => x.routeName)).size;
  const pendingFines = f.filter(x => x.progress === 'Chưa Làm Việc Với Tài Xế' || x.progress === 'Pending').length;
  const avgEff = e.length ? (e.reduce((s,x) => s + x.efficiency, 0) / e.length).toFixed(1) : 0;
  const reinfOK = rf.filter(x => x.status === 'Có xe').length;
  const totalFineCost = f.reduce((s,x) => s + (parseCost(x.cost)), 0);

  // Count expiring items
  let expiringCount = 0;
  v.forEach(x => {
    ['inspectionExpiry','liabilityExpiry','roadFeeExpiry','badgeExpiry'].forEach(fld => {
      const s = isExpiringSoon(x[fld]);
      if (s === 'expired' || s === 'critical') expiringCount++;
    });
  });

  document.getElementById('dashboardKPIs').innerHTML = makeKPI([
    {l:'Xe hoạt động', v: activeVehicles + '/' + v.length, c:'blue', i:'🚛'},
    {l:'Tài xế đang làm', v: workingDrivers + '/' + d.length, c:'green', i:'👥'},
    {l:'Tổng tuyến', v: uniqueRoutes, c:'cyan', i:'🛤️'},
    {l:'Hiệu suất TB', v: avgEff + '%', c:'purple', i:'📊'},
    {l:'Phạt nguội chờ', v: pendingFines, c: pendingFines > 0 ? 'red' : 'green', i:'🚨'},
    {l:'Hạn sắp hết', v: expiringCount, c: expiringCount > 0 ? 'orange' : 'green', i:'⚠️'},
    {l:'Tăng cường OK', v: reinfOK + '/' + rf.length, c:'green', i:'📦'},
    {l:'Tổng phạt', v: fmt(totalFineCost) + '₫', c:'red', i:'💰'}
  ]);

  // Alert message
  const alerts = [];
  if (expiringCount > 0) alerts.push(`${expiringCount} giấy tờ xe hết/sắp hết hạn`);
  if (pendingFines > 0) alerts.push(`${pendingFines} phạt nguội chưa xử lý`);
  const issueVehicles = e.filter(x => x.opStatus && x.opStatus !== 'Đang vận hành' && x.opStatus !== 'Đề xuất thanh lý').length;
  if (issueVehicles > 0) alerts.push(`${issueVehicles} xe gặp sự cố`);
  document.getElementById('dashboardAlertMsg').textContent = alerts.length > 0
    ? '⚡ ' + alerts.join(' | ')
    : '✅ Hệ thống vận hành bình thường';
}

function renderDashboardCharts() {
  destroyChartIfExists('chartDashVehicle');
  destroyChartIfExists('chartDashStaff');
  destroyChartIfExists('chartDashEfficiency');
  destroyChartIfExists('chartDashReinf');
  destroyChartIfExists('chartDashSupplier');

  // 1. Vehicle status pie
  const vStats = {};
  DATA.vehicles.forEach(x => { const s = x.status || 'N/A'; vStats[s] = (vStats[s]||0) + 1; });
  new Chart(document.getElementById('chartDashVehicle'), {
    type:'doughnut', data:{
      labels: Object.keys(vStats),
      datasets:[{data: Object.values(vStats), backgroundColor:['#10b981','#f59e0b','#ef4444','#8b5cf6'], borderWidth:0, hoverOffset:8}]
    }, options:{responsive:true, plugins:{legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'circle',padding:12}}}}
  });

  // 2. Staff status pie
  const dStats = {};
  DATA.drivers.forEach(x => { const s = x.status || 'N/A'; dStats[s] = (dStats[s]||0) + 1; });
  new Chart(document.getElementById('chartDashStaff'), {
    type:'doughnut', data:{
      labels: Object.keys(dStats),
      datasets:[{data: Object.values(dStats), backgroundColor:['#10b981','#ef4444'], borderWidth:0, hoverOffset:8}]
    }, options:{responsive:true, plugins:{legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'circle',padding:12}}}}
  });

  // 3. Efficiency distribution
  const buckets = {'0%':0,'1-20%':0,'21-40%':0,'41-60%':0,'61-80%':0,'81-100%':0};
  DATA.efficiency.forEach(x => {
    const v = x.efficiency;
    if (v === 0) buckets['0%']++;
    else if (v <= 20) buckets['1-20%']++;
    else if (v <= 40) buckets['21-40%']++;
    else if (v <= 60) buckets['41-60%']++;
    else if (v <= 80) buckets['61-80%']++;
    else buckets['81-100%']++;
  });
  new Chart(document.getElementById('chartDashEfficiency'), {
    type:'bar', data:{
      labels: Object.keys(buckets),
      datasets:[{label:'Số xe', data: Object.values(buckets), backgroundColor: CHART_COLORS.slice(0,6), borderRadius:6}]
    }, options:{responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}}
  });

  // 4. Reinforcement status
  const rfStats = {};
  DATA.reinforcement.forEach(x => {
    let s = x.status || 'N/A';
    if (s.startsWith('Hủy')) s = 'Hủy';
    rfStats[s] = (rfStats[s]||0) + 1;
  });
  new Chart(document.getElementById('chartDashReinf'), {
    type:'doughnut', data:{
      labels: Object.keys(rfStats),
      datasets:[{data: Object.values(rfStats), backgroundColor:['#10b981','#ef4444','#f59e0b','#94a3b8'], borderWidth:0, hoverOffset:8}]
    }, options:{responsive:true, plugins:{legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'circle',padding:12}}}}
  });

  // 5. Supplier distribution bar chart
  const validSuppliers = ['GHN','Huy Bảo Phát','Minh Đăng Khoa','An Hợp Tín','Việt Phong','Quân Khang Phát','Châu Khôi','Vạn Lợi'];
  const supStats = {};
  DATA.routes.forEach(x => { if (x.supplier && validSuppliers.includes(x.supplier)) supStats[x.supplier] = (supStats[x.supplier]||0) + 1; });
  const supLabels = Object.keys(supStats).sort((a,b) => supStats[b] - supStats[a]);
  new Chart(document.getElementById('chartDashSupplier'), {
    type:'bar', data:{
      labels: supLabels,
      datasets:[{label:'Số điểm dừng', data: supLabels.map(l => supStats[l]), backgroundColor: CHART_COLORS, borderRadius:6}]
    }, options:{responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}}
  });
}

// ==================== PAGE 1: THÔNG TIN XE ====================
function renderVehicles() {
  const v = DATA.vehicles;
  const active = v.filter(x => x.status === 'Hoạt động').length;
  const disposed = v.filter(x => x.status === 'Thanh lý').length;
  const issue = v.length - active - disposed;

  // Count expiring
  let expiringCount = 0;
  v.forEach(x => {
    ['inspectionExpiry','liabilityExpiry','roadFeeExpiry','badgeExpiry','regCertExpiry'].forEach(f => {
      const s = isExpiringSoon(x[f]);
      if (s === 'expired' || s === 'critical') expiringCount++;
    });
  });

  document.getElementById('vehicleKPIs').innerHTML = makeKPI([
    {l:'Tổng xe', v:v.length, c:'blue', i:'🚛'},
    {l:'Hoạt động', v:active, c:'green', i:'✅'},
    {l:'Thanh lý', v:disposed, c:'orange', i:'📋'},
    {l:'SC/Tai nạn', v:issue, c:'red', i:'🔧'},
    {l:'Hạn sắp hết', v:expiringCount, c:'red', i:'⚠️'}
  ]);

  document.getElementById('vehicleExpiryMsg').textContent =
    expiringCount > 0 ? `⚡ ${expiringCount} mục hết hạn/sắp hết hạn (đăng kiểm, BH, phí đường bộ, phù hiệu)` : '✅ Tất cả giấy tờ xe còn hạn';

  const regions = [...new Set(v.map(x=>x.region).filter(Boolean))].sort();
  populateSelect('filterVehicleRegion', regions);
  renderVehicleTable();
}

function renderVehicleTable() {
  const statusF = document.getElementById('filterVehicleStatus').value;
  const regionF = document.getElementById('filterVehicleRegion').value;
  const warnF = document.getElementById('filterVehicleWarning').value;
  const search = (document.getElementById('searchVehicle').value||'').toLowerCase();
  let data = DATA.vehicles;
  if (statusF) data = data.filter(x => x.status === statusF);
  if (regionF) data = data.filter(x => x.region === regionF);
  if (search) data = data.filter(x => (x.plate||'').toLowerCase().includes(search));
  if (warnF === 'expiring') {
    data = data.filter(x => {
      return ['inspectionExpiry','liabilityExpiry','roadFeeExpiry','badgeExpiry','regCertExpiry'].some(f => {
        const s = isExpiringSoon(x[f]);
        return s === 'expired' || s === 'critical' || s === 'warning';
      });
    });
  }

  document.getElementById('vehicleTableBody').innerHTML = data.map(x => {
    const stCls = x.status === 'Hoạt động' ? 'assigned' : x.status === 'Thanh lý' ? 'unassigned' : 'breakdown';
    return `<tr>
      <td>${escapeHTML(x.stt||'')}</td>
      <td style="font-weight:600;color:var(--text-primary)">${escapeHTML(x.plate||'')}</td>
      <td>${escapeHTML(x.tonnage||'')}</td><td>${escapeHTML(x.model||'')}</td>
      <td>${escapeHTML(x.region||'')}</td>
      <td><span class="status ${escapeHTML(stCls)}">${escapeHTML(x.status||'')}</span></td>
      ${dateCell(x.inspectionExpiry)}${dateCell(x.liabilityExpiry)}
      ${dateCell(x.roadFeeExpiry)}${dateCell(x.badgeExpiry)}
      <td>${x.totalKm ? fmt(x.totalKm) : '-'}</td><td>${escapeHTML(x.fleet||'')}</td>
    </tr>`;
  }).join('');
}

// ==================== PAGE 2: LỊCH TẢI ====================
function renderSchedule() {
  const r = DATA.routes;
  const uniqueRoutes = new Set(r.map(x=>x.routeName));
  const types = {}; r.forEach(x => { if(x.type) types[x.type]=(types[x.type]||0)+1; });
  const suppliers = {};
  const validSuppliers = ['GHN','Huy Bảo Phát','Minh Đăng Khoa','An Hợp Tín','Việt Phong','Quân Khang Phát','Châu Khôi','Vạn Lợi'];
  r.forEach(x => { if(x.supplier && validSuppliers.includes(x.supplier)) suppliers[x.supplier]=(suppliers[x.supplier]||0)+1; });

  document.getElementById('scheduleKPIs').innerHTML = makeKPI([
    {l:'Tổng tuyến', v:uniqueRoutes.size, c:'blue', i:'🛤️'},
    {l:'Điểm dừng', v:r.length, c:'cyan', i:'📍'},
    {l:'Phân loại', v:types['Phân loại']||0, c:'purple', i:'📦'},
    {l:'Giao', v:types['Giao']||0, c:'green', i:'🚚'},
    {l:'Lấy', v:types['Lấy']||0, c:'orange', i:'📥'}
  ]);

  populateSelect('filterRouteSupplier', Object.keys(suppliers).sort());
  renderScheduleTable();
}

function renderScheduleTable() {
  const typeF = document.getElementById('filterRouteType').value;
  const supF = document.getElementById('filterRouteSupplier').value;
  const search = (document.getElementById('searchRoute').value||'').toLowerCase();
  let data = DATA.routes;
  if (typeF) data = data.filter(x => x.type && x.type.includes(typeF));
  if (supF) data = data.filter(x => x.supplier === supF);
  if (search) data = data.filter(x => (x.routeName||'').toLowerCase().includes(search) || (x.warehouse||'').toLowerCase().includes(search));

  document.getElementById('scheduleTableBody').innerHTML = data.slice(0,200).map(x => {
    const typeCls = x.type==='Phân loại'?'in_transit':x.type==='Giao'?'assigned':x.type==='Lấy'?'unassigned':'completed';
    return `<tr>
      <td style="font-weight:600;color:var(--text-primary)">${escapeHTML(x.routeName||'')}</td>
      <td>${escapeHTML(x.tonnage||'')}</td><td>${escapeHTML(x.warehouse||'')}</td>
      <td><span class="status ${escapeHTML(typeCls)}">${escapeHTML(x.type||'')}</span></td>
      <td>${escapeHTML(x.arrival||'')}</td><td>${escapeHTML(x.departure||'')}</td>
      <td>${escapeHTML(x.km||'')}</td><td>${escapeHTML(x.supplier||'')}</td><td>${escapeHTML(x.note||'')}</td>
    </tr>`;
  }).join('');
}

// ==================== PAGE 3: PHẠT NGUỘI ====================
function renderFines() {
  const f = DATA.fines;
  const progresses = {};
  f.forEach(x => { if(x.progress) progresses[x.progress]=(progresses[x.progress]||0)+1; });
  const pending = f.filter(x => x.progress === 'Chưa Làm Việc Với Tài Xế' || x.progress === 'Pending').length;
  const processing = f.filter(x => x.progress === 'Đang Xử Lý Với Tài Xế').length;
  const done = f.filter(x => x.progress === 'Tạo eform hoàn ứng').length;
  const totalCost = f.reduce((s,x) => s + (parseCost(x.cost)), 0);

  document.getElementById('finesKPIs').innerHTML = makeKPI([
    {l:'Tổng vụ', v:f.length, c:'blue', i:'🚨'},
    {l:'Chưa xử lý', v:pending, c:'red', i:'⏳'},
    {l:'Đang xử lý', v:processing, c:'orange', i:'🔄'},
    {l:'Đã tạo eform', v:done, c:'green', i:'✅'},
    {l:'Tổng chi phí', v:fmt(totalCost)+'₫', c:'purple', i:'💰'}
  ]);

  // Update badges
  document.getElementById('finesBadge').textContent = pending;
  document.getElementById('headerAlertBadge').textContent = pending;

  populateSelect('filterFineProgress', Object.keys(progresses).sort());
  renderFinesTable();
}

function renderFinesTable() {
  const progF = document.getElementById('filterFineProgress').value;
  let data = DATA.fines;
  if (progF) data = data.filter(x => x.progress === progF);

  document.getElementById('finesTableBody').innerHTML = data.map(x => {
    const pCls = (x.progress==='Chưa Làm Việc Với Tài Xế'||x.progress==='Pending')?'delayed':x.progress==='Đang Xử Lý Với Tài Xế'?'unassigned':'assigned';
    const dCls = x.driverStatus === 'Đã nghỉ việc' ? 'breakdown' : 'completed';
    return `<tr>
      <td style="font-weight:600;color:var(--text-primary)">${escapeHTML(x.plate||'')}</td>
      <td>${escapeHTML(x.violationTime||'')}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis" title="${escapeHTML(x.location||'')}">${escapeHTML(x.location||'')}</td>
      <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis" title="${escapeHTML(x.violation||'')}">${escapeHTML(x.violation||'')}</td>
      <td style="font-weight:600">${x.cost ? fmt(parseCost(x.cost))+'₫' : ''}</td>
      <td>${escapeHTML(x.driverName||'')}</td>
      <td><span class="status ${escapeHTML(dCls)}">${escapeHTML(x.driverStatus||'')}</span></td>
      <td>${escapeHTML(x.sup||'')}</td>
      <td><span class="status ${escapeHTML(pCls)}">${escapeHTML(x.progress||'')}</span></td>
    </tr>`;
  }).join('');
}

// ==================== PAGE 4: HIỆU SUẤT XE ====================
function renderEfficiency() {
  const e = DATA.efficiency;
  const opStats = {};
  e.forEach(x => { if(x.opStatus) opStats[x.opStatus]=(opStats[x.opStatus]||0)+1; });
  const operating = opStats['Đang vận hành']||0;
  const avgEff = e.length ? (e.reduce((s,x)=>s+x.efficiency,0)/e.length).toFixed(1) : 0;

  document.getElementById('efficiencyKPIs').innerHTML = makeKPI([
    {l:'Tổng xe', v:e.length, c:'blue', i:'🚛'},
    {l:'Đang vận hành', v:operating, c:'green', i:'✅'},
    {l:'Đề xuất thanh lý', v:opStats['Đề xuất thanh lý']||0, c:'orange', i:'📋'},
    {l:'BTBD/Tai nạn', v:(opStats['BTBD nặng']||0)+(opStats['Xe bị tai nạn']||0)+(opStats['Xe tai nạn']||0), c:'red', i:'🔧'},
    {l:'Hiệu suất TB', v:avgEff+'%', c:'purple', i:'📊'}
  ]);

  populateSelect('filterEffOpStatus', Object.keys(opStats).sort());
  renderEfficiencyTable();
}

function renderEfficiencyCharts() {
  destroyChartIfExists('chartEfficiency');
  destroyChartIfExists('chartOpStatus');

  const e = DATA.efficiency;
  // Efficiency distribution
  const buckets = {'0%':0, '1-20%':0, '21-40%':0, '41-60%':0, '61-80%':0, '81-100%':0};
  e.forEach(x => {
    const v = x.efficiency;
    if (v === 0) buckets['0%']++;
    else if (v <= 20) buckets['1-20%']++;
    else if (v <= 40) buckets['21-40%']++;
    else if (v <= 60) buckets['41-60%']++;
    else if (v <= 80) buckets['61-80%']++;
    else buckets['81-100%']++;
  });
  new Chart(document.getElementById('chartEfficiency'), {
    type:'bar', data:{
      labels:Object.keys(buckets),
      datasets:[{label:'Số xe',data:Object.values(buckets),backgroundColor:CHART_COLORS.slice(0,6),borderRadius:6}]
    }, options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}
  });

  // Op status pie
  const opStats = {};
  e.forEach(x => { if(x.opStatus) opStats[x.opStatus]=(opStats[x.opStatus]||0)+1; });
  new Chart(document.getElementById('chartOpStatus'), {
    type:'doughnut', data:{
      labels:Object.keys(opStats),
      datasets:[{data:Object.values(opStats),backgroundColor:CHART_COLORS,borderWidth:0,hoverOffset:8}]
    }, options:{responsive:true,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'circle',padding:12}}}}
  });
}

function renderEfficiencyTable() {
  const opF = document.getElementById('filterEffOpStatus').value;
  const typeF = document.getElementById('filterEffType').value;
  let data = DATA.efficiency;
  if (opF) data = data.filter(x => x.opStatus === opF);
  if (typeF) data = data.filter(x => x.vehicleType === typeF);

  document.getElementById('efficiencyTableBody').innerHTML = data.map(x => {
    const pct = x.efficiency;
    const barCls = pct > 60 ? 'good' : pct > 30 ? 'warn' : 'danger';
    const opCls = x.opStatus==='Đang vận hành'?'assigned':x.opStatus==='Đề xuất thanh lý'?'unassigned':'breakdown';
    return `<tr>
      <td>${escapeHTML(x.stt||'')}</td>
      <td style="font-weight:600;color:var(--text-primary)">${escapeHTML(x.plate||'')}</td>
      <td>${escapeHTML(x.tonnage||'')}</td><td>${escapeHTML(x.model||'')}</td>
      <td>${escapeHTML(x.vehicleType||'')}</td><td>${escapeHTML(x.region||'')}</td>
      <td><div style="display:flex;align-items:center;gap:8px"><span style="min-width:40px">${pct}%</span><div class="capacity-bar" style="width:80px"><div class="fill ${barCls}" style="width:${pct}%"></div></div></div></td>
      <td><span class="status ${escapeHTML(opCls)}">${escapeHTML(x.opStatus||'')}</span></td>
    </tr>`;
  }).join('');
}

// ==================== PAGE 5: NHÂN SỰ ====================
function renderStaff() {
  const d = DATA.drivers;
  const working = d.filter(x => x.status === 'Đang làm việc').length;
  const resigned = d.filter(x => x.status === 'Đã nghỉ việc').length;
  const positions = {};
  d.forEach(x => { if(x.position) positions[x.position]=(positions[x.position]||0)+1; });
  const supervisors = d.filter(x => x.position && x.position.includes('Supervisor')).length;

  document.getElementById('staffKPIs').innerHTML = makeKPI([
    {l:'Tổng nhân sự', v:d.length, c:'blue', i:'👥'},
    {l:'Đang làm việc', v:working, c:'green', i:'✅'},
    {l:'Đã nghỉ việc', v:resigned, c:'red', i:'🚪'},
    {l:'Supervisor', v:supervisors, c:'purple', i:'👔'},
    {l:'Chức danh', v:Object.keys(positions).length, c:'cyan', i:'📋'}
  ]);

  populateSelect('filterDriverPosition', Object.keys(positions).sort());
  renderStaffTable();
}

function renderStaffCharts() {
  destroyChartIfExists('chartPositions');
  destroyChartIfExists('chartDriverStatus');
  const d = DATA.drivers;
  const positions = {};
  d.forEach(x => { if(x.position) positions[x.position]=(positions[x.position]||0)+1; });
  new Chart(document.getElementById('chartPositions'), {
    type:'doughnut', data:{
      labels:Object.keys(positions),
      datasets:[{data:Object.values(positions),backgroundColor:CHART_COLORS,borderWidth:0,hoverOffset:8}]
    }, options:{responsive:true,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'circle',padding:12}}}}
  });

  const statuses = {};
  d.forEach(x => { if(x.status) statuses[x.status]=(statuses[x.status]||0)+1; });
  new Chart(document.getElementById('chartDriverStatus'), {
    type:'doughnut', data:{
      labels:Object.keys(statuses),
      datasets:[{data:Object.values(statuses),backgroundColor:['#10b981','#ef4444'],borderWidth:0,hoverOffset:8}]
    }, options:{responsive:true,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'circle',padding:12}}}}
  });
}

function renderStaffTable() {
  const statusF = document.getElementById('filterDriverStatus').value;
  const posF = document.getElementById('filterDriverPosition').value;
  const search = (document.getElementById('searchDriver').value||'').toLowerCase();
  let data = DATA.drivers;
  if (statusF) data = data.filter(x => x.status === statusF);
  if (posF) data = data.filter(x => x.position === posF);
  if (search) data = data.filter(x => (x.name||'').toLowerCase().includes(search) || (x.employeeId+'').includes(search));

  document.getElementById('staffTableBody').innerHTML = data.slice(0,200).map(x => {
    const stCls = x.status==='Đang làm việc'?'assigned':'breakdown';
    return `<tr>
      <td>${escapeHTML(x.stt||'')}</td>
      <td style="font-weight:600;color:var(--text-primary)">${escapeHTML(x.employeeId||'')}</td>
      <td>${escapeHTML(x.name||'')}</td><td>${escapeHTML(x.phone||'')}</td>
      <td>${escapeHTML(x.position||'')}</td><td>${escapeHTML(x.supervisor||'')}</td>
      <td>${escapeHTML(x.route||'')}</td>
      <td><span class="status ${escapeHTML(stCls)}">${escapeHTML(x.status||'')}</span></td>
      <td>${escapeHTML(x.seniority||'')}</td>
    </tr>`;
  }).join('');
}

// ==================== PAGE 6: TĂNG CƯỜNG LẤY ====================
function renderReinforcement() {
  const r = DATA.reinforcement;
  const statuses = {};
  r.forEach(x => { if(x.status) statuses[x.status]=(statuses[x.status]||0)+1; });
  const hasVehicle = statuses['Có xe']||0;
  const noVehicle = statuses['Không có xe']||0;
  const cancelled = r.filter(x => x.status && x.status.startsWith('Hủy')).length;
  const suppliers = {};
  r.forEach(x => { if(x.supplier && typeof x.supplier === 'string') suppliers[x.supplier]=(suppliers[x.supplier]||0)+1; });

  document.getElementById('reinforcementKPIs').innerHTML = makeKPI([
    {l:'Tổng ticket', v:r.length, c:'blue', i:'📦'},
    {l:'Có xe', v:hasVehicle, c:'green', i:'✅'},
    {l:'Không có xe', v:noVehicle, c:'red', i:'❌'},
    {l:'Đã hủy', v:cancelled, c:'orange', i:'🚫'}
  ]);

  populateSelect('filterReinfStatus', Object.keys(statuses).sort());
  populateSelect('filterReinfSupplier', Object.keys(suppliers).sort());
  renderReinforcementTable();
}

function renderReinforcementTable() {
  const statusF = document.getElementById('filterReinfStatus').value;
  const supF = document.getElementById('filterReinfSupplier').value;
  const search = (document.getElementById('searchReinf').value||'').toLowerCase();
  let data = DATA.reinforcement;
  if (statusF) data = data.filter(x => x.status === statusF);
  if (supF) data = data.filter(x => x.supplier === supF);
  if (search) data = data.filter(x => (x.ticketId||'').toLowerCase().includes(search) || (x.warehouse||'').toLowerCase().includes(search));

  document.getElementById('reinforcementTableBody').innerHTML = data.slice(0,200).map(x => {
    const stCls = x.status==='Có xe'?'assigned':x.status==='Không có xe'?'breakdown':x.status&&x.status.startsWith('Hủy')?'delayed':'unassigned';
    return `<tr>
      <td style="font-weight:600;color:var(--text-primary)">${escapeHTML(x.ticketId||'')}</td>
      <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis" title="${escapeHTML(x.warehouse||'')}">${escapeHTML(x.warehouse||'')}</td>
      <td>${escapeHTML(x.route||'')}</td><td>${escapeHTML(x.packages||'')}</td>
      <td>${escapeHTML(x.date||'')}</td><td>${escapeHTML(x.arrivalTime||'')}</td>
      <td><span class="status ${escapeHTML(stCls)}">${escapeHTML(x.status||'')}</span></td>
      <td>${escapeHTML(x.supplier||'')}</td><td>${escapeHTML(x.plate||'')}</td><td>${escapeHTML(x.tonnage||'')}</td>
    </tr>`;
  }).join('');
}

// ==================== PAGE: ONTIME XE TẢI ====================
function otPct(v) { return (typeof v === 'number') ? (v * 100).toFixed(1) + '%' : '-'; }

function renderOntime() {
  const o = DATA.ontime || { groups: [], weeks: [], weekly: {}, periods: [] };
  const el = document.getElementById('ontimeKPIs');
  if (!el) return;
  const weeks = o.weeks || [];
  const last = weeks.length - 1;
  const totalW = (o.weekly && o.weekly['TOTAL']) || [];
  const otVal = last >= 0 ? totalW[last] : null;
  const prevVal = last >= 1 ? totalW[last - 1] : null;

  const kpis = [
    { l: 'Ontime tổng (' + (weeks[last] || 'mới nhất') + ')', v: otPct(otVal), c: (otVal != null && otVal >= 0.95) ? 'green' : (otVal != null && otVal >= 0.9) ? 'orange' : 'red', i: '⏱️' }
  ];
  if (otVal != null && prevVal != null) {
    const diff = (otVal - prevVal) * 100;
    kpis.push({ l: 'So với ' + (weeks[last - 1] || 'tuần trước'), v: (diff >= 0 ? '+' : '') + diff.toFixed(1) + ' điểm', c: diff >= 0 ? 'green' : 'red', i: diff >= 0 ? '📈' : '📉' });
  }
  (o.groups || []).forEach(g => {
    const arr = o.weekly[g] || [];
    const v = last >= 0 ? arr[last] : null;
    kpis.push({ l: g, v: otPct(v), c: (v != null && v >= 0.95) ? 'green' : (v != null && v >= 0.9) ? 'cyan' : 'red', i: '📍' });
  });
  el.innerHTML = makeKPI(kpis);

  const head = document.getElementById('ontimeTableHead');
  const body = document.getElementById('ontimeTableBody');
  if (head && body) {
    head.innerHTML = '<tr><th>Nhóm tuyến</th>' + weeks.map(w => '<th>' + escapeHTML(w) + '</th>').join('') + '</tr>';
    const names = (o.groups || []).concat(o.weekly && o.weekly['TOTAL'] ? ['TOTAL'] : []);
    body.innerHTML = names.map(n => {
      const arr = (o.weekly && o.weekly[n]) || [];
      return '<tr><td style="font-weight:600;color:var(--text-primary)">' + escapeHTML(n) + '</td>' +
        weeks.map((w, i) => {
          const v = arr[i];
          const cls = (v == null) ? '' : v >= 0.95 ? 'assigned' : v >= 0.9 ? 'unassigned' : 'breakdown';
          return '<td>' + (v == null ? '-' : '<span class="status ' + cls + '">' + (v * 100).toFixed(1) + '%</span>') + '</td>';
        }).join('') + '</tr>';
    }).join('');
  }
}

function renderOntimeCharts() {
  destroyChartIfExists('chartOntimeTrend');
  destroyChartIfExists('chartOntimeGroup');
  const o = DATA.ontime || { groups: [], weeks: [], weekly: {} };
  const weeks = o.weeks || [];

  const trendEl = document.getElementById('chartOntimeTrend');
  if (trendEl && weeks.length) {
    const series = (o.groups || []).concat(o.weekly && o.weekly['TOTAL'] ? ['TOTAL'] : []);
    new Chart(trendEl, {
      type: 'line',
      data: {
        labels: weeks,
        datasets: series.map((g, i) => ({
          label: g,
          data: ((o.weekly && o.weekly[g]) || []).map(v => v == null ? null : Math.round(v * 1000) / 10),
          borderColor: CHART_COLORS[i % CHART_COLORS.length],
          backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
          tension: 0.3, fill: false, borderWidth: g === 'TOTAL' ? 3 : 2, pointRadius: 3
        }))
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12 } } }, scales: { y: { ticks: { callback: v => v + '%' } } } }
    });
  }

  const grpEl = document.getElementById('chartOntimeGroup');
  if (grpEl && weeks.length) {
    const last = weeks.length - 1;
    const groups = o.groups || [];
    new Chart(grpEl, {
      type: 'bar',
      data: {
        labels: groups,
        datasets: [{ label: '%OT (' + (weeks[last] || '') + ')', data: groups.map(g => { const v = ((o.weekly && o.weekly[g]) || [])[last]; return v == null ? 0 : Math.round(v * 1000) / 10; }), backgroundColor: CHART_COLORS.slice(0, groups.length), borderRadius: 6 }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false, ticks: { callback: v => v + '%' } } } }
    });
  }
}

// ==================== PAGE: BTBD (BẢO TRÌ - SỬA CHỮA) ====================
function btbdDate(v) { if (v == null || v === '') return '-'; return String(v).replace(/\s*00:00(:00)?$/, ''); }

function renderBTBD() {
  const d = DATA.btbd || [];
  const el = document.getElementById('btbdKPIs');
  if (!el) return;
  const total = d.length;
  const uniquePlates = new Set(d.map(x => x.plate).filter(Boolean)).size;
  const inGarage = d.filter(x => !x.outDate).length;
  const incident = d.filter(x => x.content && String(x.content).toLowerCase().includes('sự cố')).length;
  const totalHours = d.reduce((s, x) => s + (typeof x.totalHours === 'number' ? x.totalHours : 0), 0);

  el.innerHTML = makeKPI([
    { l: 'Tổng lượt BTBD', v: fmt(total), c: 'blue', i: '🔧' },
    { l: 'Số xe', v: fmt(uniquePlates), c: 'cyan', i: '🚛' },
    { l: 'Đang ở xưởng', v: fmt(inGarage), c: inGarage > 0 ? 'orange' : 'green', i: '🏭' },
    { l: 'Sự cố', v: fmt(incident), c: incident > 0 ? 'red' : 'green', i: '⚠️' },
    { l: 'Tổng giờ BTBD', v: totalHours ? fmt(totalHours) : '-', c: 'purple', i: '⏱️' }
  ]);

  const contents = [...new Set(d.map(x => x.content).filter(Boolean))].sort();
  populateSelect('filterBTBDContent', contents);
  renderBTBDTable();
}

function renderBTBDTable() {
  const cF = document.getElementById('filterBTBDContent').value;
  const sF = document.getElementById('filterBTBDStatus').value;
  const search = (document.getElementById('searchBTBD').value || '').toLowerCase();
  let data = DATA.btbd || [];
  if (cF) data = data.filter(x => x.content === cF);
  if (sF === 'in') data = data.filter(x => !x.outDate);
  else if (sF === 'done') data = data.filter(x => x.outDate);
  if (search) data = data.filter(x => (x.plate || '').toLowerCase().includes(search));

  document.getElementById('btbdTableBody').innerHTML = data.slice(0, 200).map(x => {
    const done = !!x.outDate;
    const stCls = done ? 'assigned' : 'unassigned';
    const stTxt = done ? 'Hoàn thành' : 'Đang xử lý';
    return `<tr>
      <td style="font-weight:600;color:var(--text-primary)">${escapeHTML(x.plate || '')}</td>
      <td>${escapeHTML(x.vehicleInfo || '')}</td>
      <td>${x.odo != null ? escapeHTML(x.odo) : '-'}</td>
      <td>${escapeHTML(btbdDate(x.inDate))}</td>
      <td>${escapeHTML(x.content || '')}</td>
      <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis" title="${escapeHTML(x.detail || x.category || '')}">${escapeHTML(x.category || x.detail || '')}</td>
      <td>${escapeHTML(x.garage || '')}</td>
      <td>${escapeHTML(btbdDate(x.outDate))}</td>
      <td><span class="status ${stCls}">${stTxt}</span></td>
    </tr>`;
  }).join('');
}

function renderBTBDCharts() {
  destroyChartIfExists('chartBTBDContent');
  destroyChartIfExists('chartBTBDTop');
  const d = DATA.btbd || [];

  const cStats = {};
  d.forEach(x => { const k = x.content || 'Khác'; cStats[k] = (cStats[k] || 0) + 1; });
  const cEl = document.getElementById('chartBTBDContent');
  if (cEl) new Chart(cEl, {
    type: 'doughnut',
    data: { labels: Object.keys(cStats), datasets: [{ data: Object.values(cStats), backgroundColor: CHART_COLORS, borderWidth: 0, hoverOffset: 8 }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12 } } } }
  });

  const pStats = {};
  d.forEach(x => { if (x.plate) pStats[x.plate] = (pStats[x.plate] || 0) + 1; });
  const top = Object.keys(pStats).sort((a, b) => pStats[b] - pStats[a]).slice(0, 8);
  const tEl = document.getElementById('chartBTBDTop');
  if (tEl) new Chart(tEl, {
    type: 'bar',
    data: { labels: top, datasets: [{ label: 'Số lượt', data: top.map(p => pStats[p]), backgroundColor: CHART_COLORS, borderRadius: 6 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

// === GOOGLE SHEET SYNC SYSTEM & INIT ===
// === GOOGLE SHEET SYNC MODULE ===
function destroyChartIfExists(canvasId) {
  try {
    const ctx = document.getElementById(canvasId);
    if (ctx) {
      const chartInstance = Chart.getChart(ctx);
      if (chartInstance) {
        chartInstance.destroy();
      }
    }
  } catch (e) {
    console.error('Error destroying chart ' + canvasId + ':', e);
  }
}

function destroyAllCharts() {
  const chartIds = [
    'chartDashVehicle', 'chartDashStaff', 'chartDashEfficiency',
    'chartDashReinf', 'chartDashSupplier', 'chartEfficiency', 'chartOpStatus',
    'chartPositions', 'chartDriverStatus', 'chartOntimeTrend', 'chartOntimeGroup',
    'chartBTBDContent', 'chartBTBDTop'
  ];
  chartIds.forEach(destroyChartIfExists);
}

function updateGlobalSyncStatus(timestamp) {
  const statusTime = document.getElementById('globalSyncTime');
  if (!statusTime) return;
  if (timestamp) {
    statusTime.innerHTML = `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#3b82f6; animation:pulse 2s infinite"></span> Realtime: ${timestamp.split(' ')[0]}`;
    statusTime.style.color = '#3b82f6';
  } else {
    statusTime.innerHTML = `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--text-muted)"></span> Dữ liệu: Mặc định`;
    statusTime.style.color = 'var(--text-muted)';
  }
}

// Add a pulse keyframes style in body if not already present
if (!document.getElementById('pulse-style')) {
  const s = document.createElement('style');
  s.id = 'pulse-style';
  s.innerHTML = `@keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }`;
  document.head.appendChild(s);
}

function ser(val) {
  if (val === undefined || val === null) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    const hh = String(val.getHours()).padStart(2, '0');
    const mm = String(val.getMinutes()).padStart(2, '0');
    if (hh === '00' && mm === '00') {
      return `${y}-${m}-${d}`;
    }
    return `${hh}:${mm}`;
  }
  if (typeof val === 'number') return val;
  const s = String(val).trim();
  if (s === '' || s === '#N/A' || s === '#DIV/0!' || s === '#VALUE!' || s === '#REF!' || s === '#NAME?') return null;
  return s;
}

function loadCachedFullData() {
  try {
    const cached = localStorage.getItem('cached_full_data');
    const cachedTime = localStorage.getItem('cached_full_time');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.vehicles) DATA.vehicles = parsed.vehicles;
      if (parsed.routes) DATA.routes = parsed.routes;
      if (parsed.fines) DATA.fines = parsed.fines;
      if (parsed.efficiency) DATA.efficiency = parsed.efficiency;
      if (parsed.drivers) DATA.drivers = parsed.drivers;
      if (parsed.reinforcement) DATA.reinforcement = parsed.reinforcement;
      if (parsed.ontime) DATA.ontime = parsed.ontime;
      if (parsed.btbd) DATA.btbd = parsed.btbd;
      setTimeout(() => updateGlobalSyncStatus(cachedTime), 50);
    } else {
      setTimeout(() => updateGlobalSyncStatus(null), 50);
    }
  } catch (e) {
    console.error('Error loading cached full data:', e);
  }
}

// Trích xuất ID Google Sheet từ URL (mặc định hoặc do người dùng đặt)
function getSheetId(userUrl) {
  const defaultId = '1n__ebFqgiGQSIEh0xncDCvxYcInsbVQQc0TbSQndz70';
  const url = userUrl || localStorage.getItem('custom_sheet_url') || '';
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return (match && match[1]) ? match[1] : defaultId;
}

// Tự nhận diện cột ngày/giờ theo tên tiêu đề để chuyển số serial -> Date
const SYNC_DATE_RE = /ngày|hạn|giờ|thời gian|tới điểm|rời điểm|\bdate\b|\btime\b/i;

function syncSerialToDate(v) {
  if (typeof v !== 'number') return v;
  try {
    const d = XLSX.SSF.parse_date_code(v);
    if (d && d.y) return new Date(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, Math.floor(d.S || 0));
  } catch (e) {}
  return v;
}

// Tải 1 sheet qua gviz CSV của Google (hỗ trợ CORS trực tiếp, không cần proxy)
async function fetchSheetAsWorksheet(id, name) {
  const url = 'https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(name);
  const res = await fetch(url);
  if (!res.ok) throw new Error(name + ': HTTP ' + res.status);
  const text = await res.text();
  const wb = XLSX.read(text, { type: 'string' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
  const headers = rows[0] || [];
  const dateCols = headers
    .map((h, i) => SYNC_DATE_RE.test(String(h == null ? '' : h)) ? i : -1)
    .filter(i => i >= 0);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    for (const c of dateCols) {
      if (typeof row[c] === 'number') row[c] = syncSerialToDate(row[c]);
    }
  }
  return XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
}

const SYNC_SHEET_NAMES = ['Thông tin xe', 'Lịch tải', 'Phạt nguội', 'Hiệu suất sử dụng xe', 'Nhân sự', 'Tải tăng cường Lấy'];
const SYNC_OPTIONAL_SHEETS = ['Ontime xe tải', 'BTBD'];

async function syncGoogleSheetRealtime(silent = false) {
  const statusTime = document.getElementById('globalSyncTime');
  if (statusTime) {
    statusTime.innerHTML = `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#f59e0b; animation:pulse 1s infinite"></span> Đang tải Realtime...`;
    statusTime.style.color = '#f59e0b';
  }

  const id = getSheetId(localStorage.getItem('custom_sheet_url'));

  try {
    const workbook = { SheetNames: [], Sheets: {} };
    const allNames = SYNC_SHEET_NAMES.concat(SYNC_OPTIONAL_SHEETS);
    const results = await Promise.all(
      allNames.map(n =>
        fetchSheetAsWorksheet(id, n).then(ws => ({ n, ws })).catch(e => ({ n, err: e }))
      )
    );
    for (const r of results) {
      if (r.ws) { workbook.SheetNames.push(r.n); workbook.Sheets[r.n] = r.ws; }
      else { console.warn('Sync sheet thất bại:', r.n, r.err && r.err.message); }
    }
    const missingCore = SYNC_SHEET_NAMES.filter(n => !workbook.Sheets[n]);
    if (missingCore.length) {
      throw new Error('Thiếu sheet: ' + missingCore.join(', ') + '. Kiểm tra Google Sheet đã ở chế độ "Bất kỳ ai có đường liên kết đều xem được".');
    }

    processAndApplyWorkbook(workbook);
  } catch (error) {
    console.error('Realtime Sync error:', error);
    if (statusTime) {
      const cachedTime = localStorage.getItem('cached_full_time');
      if (cachedTime) {
        statusTime.innerHTML = `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#10b981"></span> Realtime (Offline): ${cachedTime.split(' ')[0]}`;
        statusTime.style.color = '#10b981';
      } else {
        statusTime.innerHTML = `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--text-muted)"></span> Dữ liệu: Mặc định`;
        statusTime.style.color = 'var(--text-muted)';
      }
    }
    if (!silent) {
      alert('Không thể tải dữ liệu trực tuyến: ' + error.message + '\n\nBạn có thể dùng nút "📂 Import file Excel" để nạp dữ liệu từ file tải về.');
    }
  }
}

function changeSheetLink() {
  const defaultUrl = 'https://docs.google.com/spreadsheets/d/1n__ebFqgiGQSIEh0xncDCvxYcInsbVQQc0TbSQndz70/edit?gid=772669565';
  const currentUrl = localStorage.getItem('custom_sheet_url') || defaultUrl;
  window.open(currentUrl, '_blank');

}

function processAndApplyWorkbook(workbook) {
  // 1. VEHICLES (Thông tin xe)
  const vSheet = workbook.Sheets['Thông tin xe'];
  const vRows = XLSX.utils.sheet_to_json(vSheet, {header: 1, raw: true});
  const vehicles = [];
  for (let i = 1; i < vRows.length; i++) {
    const row = vRows[i] || [];
    const plate = row[1];
    if (!plate) continue;
    vehicles.push({
      stt: ser(row[0]),
      plate: ser(plate),
      tonnage: ser(row[2]),
      model: ser(row[3]),
      region: ser(row[5]),
      department: ser(row[6]),
      boxVolume: ser(row[7]),
      yearReceived: ser(row[9]),
      yearsUsed: ser(row[11]),
      condition: ser(row[12]),
      status: ser(row[13]),
      insuranceExpiry: ser(row[14]),
      inspectionCode: ser(row[15]),
      inspectionExpiry: ser(row[16]),
      liabilityExpiry: ser(row[17]),
      roadFeeExpiry: ser(row[18]),
      badgeExpiry: ser(row[19]),
      regCertExpiry: ser(row[20]),
      totalKm: ser(row[23]),
      warning: ser(row[25]),
      note: ser(row[26]),
      fleet: ser(row[27]),
    });
  }

  // 2. ROUTES (Lịch tải)
  const rSheet = workbook.Sheets['Lịch tải'];
  const rRows = XLSX.utils.sheet_to_json(rSheet, {header: 1, raw: true});
  const routes = [];
  for (let i = 1; i < rRows.length; i++) {
    const row = rRows[i] || [];
    const rname = row[0];
    if (!rname) continue;
    routes.push({
      routeName: ser(rname),
      tonnage: ser(row[1]),
      warehouse: ser(row[2]),
      type: ser(row[3]),
      arrival: ser(row[4]),
      departure: ser(row[5]),
      note: ser(row[6]),
      km: ser(row[7]),
      supplier: ser(row[8]),
    });
  }

  // 3. FINES (Phạt nguội)
  const fSheet = workbook.Sheets['Phạt nguội'];
  const fRows = XLSX.utils.sheet_to_json(fSheet, {header: 1, raw: true});
  const fines = [];
  for (let i = 1; i < fRows.length; i++) {
    const row = fRows[i] || [];
    const plate = row[4]; // col E is BKS
    if (!plate) continue;
      fines.push({
      reportDate: ser(row[0]),
      plate: ser(plate),
      depot: ser(row[5]),
      violationTime: ser(row[7]),
      location: ser(row[9]),
      violation: ser(row[10]),
      cost: ser(row[11]),
      sup: ser(row[13]),
      driverId: ser(row[14]),
      driverName: ser(row[15]),
      driverStatus: ser(row[16]),
      expectedDate: ser(row[17]),
      progress: ser(row[19]),    
  });
  }

  // 4. EFFICIENCY (Hiệu suất sử dụng xe)
  const eSheet = workbook.Sheets['Hiệu suất sử dụng xe'];
  const eRows = XLSX.utils.sheet_to_json(eSheet, {header: 1, raw: true});
  const efficiency = [];
  for (let i = 1; i < eRows.length; i++) {
    const row = eRows[i] || [];
    const plate = row[1];
    if (!plate) continue;
    const effVal = row[15]; // index 15 is col 16 (Hiệu suất sử dụng xe)
    let numEff = 0;
    if (typeof effVal === 'number') {
      numEff = Math.round(effVal * 100 * 10) / 10;
    } else if (typeof effVal === 'string') {
      let clean = effVal.replace('%', '').trim().replace(',', '.');
      numEff = parseFloat(clean);
      if (isNaN(numEff)) numEff = 0;
      if (numEff > 0 && numEff <= 1 && !effVal.includes('%')) {
        numEff = numEff * 100;
      }
      numEff = Math.round(numEff * 10) / 10;
    }
    efficiency.push({
      stt: ser(row[0]),
      plate: ser(plate),
      tonnage: ser(row[2]),
      model: ser(row[3]),
      region: ser(row[5]),
      department: ser(row[6]),
      yearsUsed: ser(row[11]),
      condition: ser(row[12]),
      status: ser(row[13]),
      vehicleType: ser(row[14]),
      efficiency: numEff,
      opStatus: ser(row[16]),
    });
  }

  // 5. DRIVERS (Nhân sự)
  const dSheet = workbook.Sheets['Nhân sự'] || workbook.Sheets['Tài xế'];
  const dRows = XLSX.utils.sheet_to_json(dSheet, {header: 1, raw: true});
  const drivers = [];
  for (let i = 1; i < dRows.length; i++) {
    const row = dRows[i] || [];
    const name = row[2]; // col 3
    if (!name) continue;
    drivers.push({
      stt: ser(row[0]),
      employeeId: ser(row[1]),
      name: ser(name),
      phone: ser(row[3]),
      position: ser(row[4]),
      unit: ser(row[5]),
      supervisor: ser(row[6]),
      shift: ser(row[7]),
      route: ser(row[8]),
      startDate: ser(row[9]),
      endDate: ser(row[10]),
      status: ser(row[11]),
      seniority: ser(row[12]),
      seniorityDetail: ser(row[13]),
    });
  }

  // 6. REINFORCEMENT (Tải tăng cường Lấy)
  const rfSheet = workbook.Sheets['Tải tăng cường Lấy'];
  const rfRows = XLSX.utils.sheet_to_json(rfSheet, {header: 1, raw: true});
  const reinforcement = [];
  for (let i = 1; i < rfRows.length; i++) {
    const row = rfRows[i] || [];
    const tid = row[0];
    if (!tid) continue;
    reinforcement.push({
      ticketId: ser(tid),
      region: ser(row[1]),
      warehouse: ser(row[2]),
      route: ser(row[4]),
      employeeId: ser(row[5]),
      phone: ser(row[7]),
      packages: ser(row[8]),
      volumeNeeded: ser(row[9]),
      requestDate: ser(row[10]),
      note: ser(row[11]),
      status: ser(row[12]),
      date: ser(row[13]),
      arrivalTime: ser(row[14]),
      tripCode: ser(row[15]),
      supplier: ser(row[16]),
      plate: ser(row[17]),
      tonnage: ser(row[18]),
      driverInfo: ser(row[19]),
    });
  }

  // 7. ONTIME (Ontime xe tải) - lấy bảng "Ontime theo Tuần"
  const ontime = { groups: [], weeks: [], weekly: {} };
  const oSheet = workbook.Sheets['Ontime xe tải'];
  if (oSheet) {
    const oRows = XLSX.utils.sheet_to_json(oSheet, { header: 1, raw: true, defval: null });
    // Tìm dòng tiêu đề 'Tuyến' của bảng theo tuần (nhãn cột có chứa 'W' như W18...);
    // nếu không thấy thì lấy dòng 'Tuyến' đầu tiên làm phương án dự phòng.
    let headerIdx = -1;
    for (let i = 0; i < oRows.length; i++) {
      const r = oRows[i]; if (!r) continue;
      if (String(r[0] == null ? '' : r[0]).trim() === 'Tuyến') {
        const labels = r.slice(1).filter(x => x !== null && String(x).trim() !== '');
        if (labels.some(x => /w/i.test(String(x)))) { headerIdx = i; break; }
        if (headerIdx < 0) headerIdx = i;
      }
    }
    if (headerIdx >= 0) {
      const headerRow = oRows[headerIdx] || [];
      const cols = [];
      for (let c = 1; c < headerRow.length; c++) {
        if (headerRow[c] !== null && String(headerRow[c]).trim() !== '') cols.push(c);
      }
      ontime.weeks = cols.map(c => String(headerRow[c]).trim());
      for (let i = headerIdx + 1; i < oRows.length; i++) {
        const r = oRows[i]; if (!r) continue;
        const name = String(r[0] == null ? '' : r[0]).trim();
        if (!name) continue;
        if (name === 'Tuyến' || /ontime theo/i.test(name)) break;
        ontime.weekly[name] = cols.map(c => (typeof r[c] === 'number' ? r[c] : null));
        if (name !== 'TOTAL') ontime.groups.push(name);
      }
    }
  }

  // 8. BTBD (Bảo trì - Sửa chữa)
  const btbd = [];
  const bSheet = workbook.Sheets['BTBD'];
  if (bSheet) {
    const bRows = XLSX.utils.sheet_to_json(bSheet, { header: 1, raw: true, defval: null });
    for (let i = 1; i < bRows.length; i++) {
      const row = bRows[i] || [];
      const plate = row[0];
      if (!plate) continue;
      btbd.push({
        plate: ser(plate),
        vehicleInfo: ser(row[1]),
        yearUse: ser(row[2]),
        odo: ser(row[3]),
        kmNextBD: ser(row[4]),
        inDate: ser(row[5]),
        content: ser(row[6]),
        category: ser(row[7]),
        detail: ser(row[8]),
        garage: ser(row[9]),
        expectedDate: ser(row[10]),
        outDate: ser(row[11]),
        totalHours: ser(row[12]),
        note: ser(row[13]),
      });
    }
  }

  // Update memory
  DATA.vehicles = vehicles;
  DATA.routes = routes;
  DATA.fines = fines;
  DATA.efficiency = efficiency;
  DATA.drivers = drivers;
  DATA.reinforcement = reinforcement;
  DATA.ontime = ontime;
  DATA.btbd = btbd;

  // Persist to localStorage
  const now = new Date();
  const timeStr = now.toLocaleTimeString('vi-VN') + ' (' + now.toLocaleDateString('vi-VN') + ')';
  localStorage.setItem('cached_full_data', JSON.stringify({
    vehicles, routes, fines, efficiency, drivers, reinforcement, ontime, btbd
  }));
  localStorage.setItem('cached_full_time', timeStr);

  // Update top sync status display
  updateGlobalSyncStatus(timeStr);

  // Reset chart flags
  window._dashChartsRendered = false;
  window._effChartsRendered = false;
  window._staffChartsRendered = false;
  window._ontimeChartsRendered = false;
  window._btbdChartsRendered = false;

  // Refresh current visible page
  const activePageItem = document.querySelector('.nav-item.active');
  const pageName = activePageItem ? activePageItem.getAttribute('data-page') : 'dashboard';

  renderDashboard();
  renderVehicles();
  renderSchedule();
  renderFines();
  renderEfficiency();
  renderStaff();
  renderReinforcement();
  renderOntime();
  renderBTBD();

  destroyAllCharts();
  navigateTo(pageName);
}

function resetGlobalSyncData() {
  if (confirm('Bạn có chắc chắn muốn xóa dữ liệu đồng bộ và khôi phục về dữ liệu mặc định (file cứng) không?')) {
    localStorage.removeItem('cached_full_data');
    localStorage.removeItem('cached_full_time');
    location.reload();
  }
}

function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {type: 'array', cellDates: true, cellNF: false, cellText: false});
      processAndApplyWorkbook(workbook);
      alert('Tải dữ liệu từ file Excel thành công!');
    } catch (error) {
      console.error(error);
      alert('Lỗi tải file Excel: ' + error.message);
    }
  };
  reader.readAsArrayBuffer(file);
  event.target.value = '';
}


// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  loadCachedFullData();
  renderDashboard();
  renderDashboardCharts();
  window._dashChartsRendered = true;
  renderVehicles();
  renderSchedule();
  renderFines();
  renderEfficiency();
  renderStaff();
  renderReinforcement();
  renderOntime();
  renderBTBD();

  // Tự động lấy dữ liệu realtime khi tải trang (chế độ chạy ngầm không hiện thông báo thành công)
  setTimeout(() => {
    syncGoogleSheetRealtime(true);
  }, 100);

  // Tự động cập nhật ngầm dữ liệu từ Google Sheet mỗi 1 phút (60 giây)
  setInterval(() => {
    syncGoogleSheetRealtime(true);
  }, 60000);
});
// build: ontime + btbd modules
