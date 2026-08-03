
// === NAVIGATION ===
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  const titles = {
    dashboard:'📊 Dashboard Tổng quan', vehicles:'🚛 Thông tin xe', schedule:'📋 Lịch Tải',
    fines:'🚨 Phạt Nguội', efficiency:'📊 Hiệu suất xe', staff:'👥 Nhân sự',
    reinforcement:'📦 Tăng cường Lấy', ontime:'⏱️ Ontime xe tải', btbd:'🔧 Bảo trì - Sửa chữa (BTBD)',
    assessment:'📈 Đánh giá & Cải thiện', cost:'💰 Chi phí', trends:'📉 Xu hướng'
  };
  document.getElementById('pageTitle').textContent = titles[page] || '';
  if (page === 'dashboard' && !window._dashChartsRendered) { renderDashboardCharts(); window._dashChartsRendered = true; }
  if (page === 'efficiency' && !window._effChartsRendered) { renderEfficiencyCharts(); window._effChartsRendered = true; }
  if (page === 'staff' && !window._staffChartsRendered) { renderStaffCharts(); window._staffChartsRendered = true; }
  if (page === 'ontime' && !window._ontimeChartsRendered) { renderOntimeCharts(); window._ontimeChartsRendered = true; }
  if (page === 'btbd' && !window._btbdChartsRendered) { renderBTBDCharts(); window._btbdChartsRendered = true; }
  if (page === 'cost' && !window._costChartsRendered) { renderCostCharts(); window._costChartsRendered = true; }
  if (page === 'trends' && !window._trendChartsRendered) { renderTrendCharts(); window._trendChartsRendered = true; }
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
// Trích tháng (YYYY-MM) từ ô ngày: hỗ trợ chuỗi DD/MM/YYYY, YYYY-MM-DD và số serial Excel
function monthKeyFromDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' || (/^\d+(\.\d+)?$/.test(String(v).trim()) && Number(v) > 20000)) {
    const dt = new Date(Math.round((Number(v) - 25569) * 86400000));
    return isNaN(dt) ? null : dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0');
  }
  const str = String(v).trim();
  let m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return m[3] + '-' + m[2].padStart(2, '0');
  m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return m[1] + '-' + m[2].padStart(2, '0');
  const dt = new Date(str); return isNaN(dt) ? null : dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
}
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

// ==================== PAGE: ĐÁNH GIÁ & CẢI THIỆN ====================
const ACTION_ITEMS = [
  { id: 'eff',      p: 'Cao',  area: 'Hiệu suất xe', task: 'Xác minh định nghĩa & nâng hiệu suất sử dụng xe lên ≥70% (gộp tuyến, cắt/luân chuyển xe dư).' },
  { id: 'docs',     p: 'Cao',  area: 'Tuân thủ',     task: 'Xử lý dứt điểm giấy tờ xe sắp/hết hạn — phân công SUP theo deadline (số ngày còn lại).' },
  { id: 'fines',    p: 'Cao',  area: 'Phạt nguội',   task: 'Đóng dứt điểm các phạt nguội tồn, theo dõi tiến độ theo SUP phụ trách.' },
  { id: 'turnover', p: 'Cao',  area: 'Nhân sự',      task: 'Phân tích lý do nghỉ việc theo tháng, đề ra giải pháp giữ chân tài xế.' },
  { id: 'reinf',    p: 'TB',   area: 'Điều phối',    task: 'Nâng tỷ lệ đáp ứng yêu cầu tăng cường lên ≥90% (điều phối NCC).' },
  { id: 'source',   p: 'TB',   area: 'Dữ liệu',      task: 'Chuẩn hóa một nguồn số xe chuẩn (thống nhất tổng đội xe giữa các sheet).' },
  { id: 'cost',     p: 'TB',   area: 'Chi phí',      task: 'Bổ sung chỉ số chi phí: đồng/km, chi phí BTBD theo xe, phạt theo SUP/đội.' },
  { id: 'trend',    p: 'Thấp', area: 'Phân tích',    task: 'Lưu dữ liệu theo thời gian để theo dõi xu hướng (hiệu suất, nghỉ việc, ontime, phạt).' },
  { id: 'privacy',  p: 'Thấp', area: 'Bảo mật',      task: 'Bảo vệ dữ liệu nhân sự nhạy cảm (người thân, STK ngân hàng, địa chỉ).' },
];

function renderAssessment() {
  const el = document.getElementById('assessmentContent');
  if (!el) return;
  const v = DATA.vehicles || [], d = DATA.drivers || [], e = DATA.efficiency || [], f = DATA.fines || [], rf = DATA.reinforcement || [];

  const totalVeh = v.length, activeVeh = v.filter(x => x.status === 'Hoạt động').length;
  const activePct = totalVeh ? activeVeh / totalVeh * 100 : 0;
  const opVeh = e.filter(x => x.opStatus === 'Đang vận hành');
  const avgEff = opVeh.length ? opVeh.reduce((s, x) => s + (Number(x.efficiency) || 0), 0) / opVeh.length : 0;
  const totalStaff = d.length, resigned = d.filter(x => x.status === 'Đã nghỉ việc').length;
  const resignPct = totalStaff ? resigned / totalStaff * 100 : 0;
  let expiring = 0;
  v.forEach(x => { ['inspectionExpiry', 'liabilityExpiry', 'roadFeeExpiry', 'badgeExpiry'].forEach(fld => { const st = isExpiringSoon(x[fld]); if (st === 'expired' || st === 'critical') expiring++; }); });
  const pendingFines = f.filter(x => x.progress === 'Chưa Làm Việc Với Tài Xế' || x.progress === 'Pending').length;
  const reinfOK = rf.filter(x => x.status === 'Có xe').length;
  const reinfPct = rf.length ? reinfOK / rf.length * 100 : 0;

  const rows = [
    { l: 'Hiệu suất sử dụng xe (TB xe đang vận hành)', val: avgEff.toFixed(1) + '%', tgt: '≥ 70%',
      st: avgEff >= 70 ? 'good' : avgEff >= 50 ? 'warn' : 'bad',
      note: avgEff < 50 ? 'Rất thấp — xác minh cách đo & tối ưu đội xe (gộp tuyến, cắt xe dư).' : 'Theo dõi, hướng tới mục tiêu.' },
    { l: 'Tỷ lệ xe hoạt động', val: activePct.toFixed(1) + '% (' + activeVeh + '/' + totalVeh + ')', tgt: '≥ 90%',
      st: activePct >= 90 ? 'good' : activePct >= 80 ? 'warn' : 'bad',
      note: activePct >= 90 ? 'Đạt mức tốt.' : 'Rà soát xe ngừng hoạt động.' },
    { l: 'Tỷ lệ nghỉ việc (lũy kế)', val: resignPct.toFixed(1) + '% (' + resigned + '/' + totalStaff + ')', tgt: '≤ 20%',
      st: resignPct <= 20 ? 'good' : resignPct <= 30 ? 'warn' : 'bad',
      note: resignPct > 30 ? 'Cao — phân tích lý do nghỉ theo tháng, giải pháp giữ chân.' : 'Theo dõi biến động nhân sự.' },
    { l: 'Giấy tờ xe hết/sắp hết hạn (≤30 ngày)', val: expiring + ' mục', tgt: '0 mục',
      st: expiring === 0 ? 'good' : expiring <= 10 ? 'warn' : 'bad',
      note: expiring > 0 ? 'Rủi ro tuân thủ — phân công xử lý theo deadline.' : 'Không có mục quá hạn.' },
    { l: 'Phạt nguội chưa xử lý', val: pendingFines + ' vụ', tgt: '0 vụ',
      st: pendingFines === 0 ? 'good' : pendingFines <= 5 ? 'warn' : 'bad',
      note: pendingFines > 0 ? 'Cần dứt điểm, theo dõi theo SUP phụ trách.' : 'Đã xử lý hết.' },
    { l: 'Tỷ lệ đáp ứng tăng cường', val: reinfPct.toFixed(1) + '% (' + reinfOK + '/' + rf.length + ')', tgt: '≥ 90%',
      st: reinfPct >= 90 ? 'good' : reinfPct >= 75 ? 'warn' : 'bad',
      note: reinfPct < 90 ? 'Cải thiện điều phối NCC để đủ xe.' : 'Đáp ứng tốt.' },
  ];
  const badge = st => st === 'good' ? '<span class="status completed">🟢 Đạt</span>'
    : st === 'warn' ? '<span class="status delayed">🟡 Cần chú ý</span>'
    : '<span class="status breakdown">🔴 Chưa đạt</span>';
  el.innerHTML = rows.map(r => `<tr>
      <td style="font-weight:600;color:var(--text-primary)">${escapeHTML(r.l)}</td>
      <td>${escapeHTML(r.val)}</td>
      <td>${escapeHTML(r.tgt)}</td>
      <td>${badge(r.st)}</td>
      <td>${escapeHTML(r.note)}</td>
    </tr>`).join('');

  renderActionItems();
}

function getActionDone() {
  try { return JSON.parse(localStorage.getItem('assessment_done') || '[]'); } catch (e) { return []; }
}
function renderActionItems() {
  const el = document.getElementById('actionItemsBody');
  if (!el) return;
  const done = getActionDone();
  const pri = p => p === 'Cao' ? '<span class="status breakdown">Cao</span>'
    : p === 'TB' ? '<span class="status delayed">Trung bình</span>'
    : '<span class="status completed">Thấp</span>';
  el.innerHTML = ACTION_ITEMS.map(a => {
    const isDone = done.includes(a.id);
    return `<tr style="cursor:pointer;${isDone ? 'opacity:0.55' : ''}" onclick="toggleActionItem('${a.id}')">
      <td style="text-align:center;font-size:16px">${isDone ? '✅' : '⬜'}</td>
      <td>${pri(a.p)}</td>
      <td>${escapeHTML(a.area)}</td>
      <td style="${isDone ? 'text-decoration:line-through;color:var(--text-muted)' : 'font-weight:500;color:var(--text-primary)'}">${escapeHTML(a.task)}</td>
    </tr>`;
  }).join('');
  const doneCount = ACTION_ITEMS.filter(a => done.includes(a.id)).length;
  const prog = document.getElementById('actionProgress');
  if (prog) prog.textContent = 'Hoàn thành ' + doneCount + '/' + ACTION_ITEMS.length;
}
function toggleActionItem(id) {
  let done = getActionDone();
  if (done.includes(id)) done = done.filter(x => x !== id); else done.push(id);
  localStorage.setItem('assessment_done', JSON.stringify(done));
  renderActionItems();
}

// ==================== PAGE: CHI PHÍ ====================
function renderCost() {
  const b = DATA.btbd || [], f = DATA.fines || [];
  const totalBTBD = b.reduce((s, x) => s + parseCost(x.cost), 0);
  const totalFine = f.reduce((s, x) => s + parseCost(x.cost), 0);
  const total = totalBTBD + totalFine;
  let finePaid = 0, fineUnpaid = 0;
  f.forEach(x => { const c = parseCost(x.cost); if (finePaidClass(x) === 'paid') finePaid += c; else fineUnpaid += c; });
  const kpiEl = document.getElementById('costKPIs');
  if (kpiEl) kpiEl.innerHTML = makeKPI([
    { l: 'Chi phí BTBD (' + b.length + ' lượt)', v: fmt(totalBTBD) + '₫', c: 'purple', i: '🔧' },
    { l: 'BTBD bình quân/lượt', v: b.length ? fmt(totalBTBD / b.length) + '₫' : '—', c: 'blue', i: '🏭' },
    { l: 'Chi phí Phạt nguội (' + f.length + ' vụ)', v: fmt(totalFine) + '₫', c: 'red', i: '🚨' },
    { l: 'Phạt đã đóng / chưa đóng', v: fmt(finePaid) + ' / ' + fmt(fineUnpaid) + '₫', c: 'orange', i: '⚖️' },
    { l: 'Tổng chi phí (BTBD+Phạt)', v: fmt(total) + '₫', c: 'green', i: '💰' },
  ]);
  const byVeh = {};
  b.forEach(x => { const pl = x.plate || 'N/A'; if (!byVeh[pl]) byVeh[pl] = { n: 0, c: 0 }; byVeh[pl].n++; byVeh[pl].c += parseCost(x.cost); });
  const topVeh = Object.entries(byVeh).sort((a, b2) => b2[1].c - a[1].c).slice(0, 15);
  const tvEl = document.getElementById('costTopVehBody');
  if (tvEl) tvEl.innerHTML = topVeh.map(([pl, o], i) => `<tr><td>${i + 1}</td><td style="font-weight:600;color:var(--text-primary)">${escapeHTML(pl)}</td><td>${o.n}</td><td style="font-weight:600">${fmt(o.c)}₫</td></tr>`).join('');
  const bySup = {};
  f.forEach(x => { const su = x.sup || '(Chưa gán)'; if (!bySup[su]) bySup[su] = { n: 0, c: 0 }; bySup[su].n++; bySup[su].c += parseCost(x.cost); });
  const supRows = Object.entries(bySup).sort((a, b2) => b2[1].c - a[1].c);
  const bsEl = document.getElementById('costBySupBody');
  if (bsEl) bsEl.innerHTML = supRows.map(([su, o]) => `<tr><td style="font-weight:600;color:var(--text-primary)">${escapeHTML(su)}</td><td>${o.n}</td><td style="font-weight:600">${fmt(o.c)}₫</td></tr>`).join('');
}
function renderCostCharts() {
  destroyChartIfExists('chartCostStructure');
  destroyChartIfExists('chartCostTopVeh');
  const b = DATA.btbd || [], f = DATA.fines || [];
  const totalBTBD = b.reduce((s, x) => s + parseCost(x.cost), 0);
  const totalFine = f.reduce((s, x) => s + parseCost(x.cost), 0);
  const sEl = document.getElementById('chartCostStructure');
  if (sEl) new Chart(sEl, { type: 'doughnut', data: { labels: ['Chi phí BTBD', 'Phạt nguội'], datasets: [{ data: [totalBTBD, totalFine], backgroundColor: ['#f59e0b', '#ef4444'], borderWidth: 0, hoverOffset: 8 }] }, options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12 } } } } });
  const byVeh = {};
  b.forEach(x => { const pl = x.plate || 'N/A'; byVeh[pl] = (byVeh[pl] || 0) + parseCost(x.cost); });
  const top = Object.entries(byVeh).sort((a, b2) => b2[1] - a[1]).slice(0, 10);
  const tEl = document.getElementById('chartCostTopVeh');
  if (tEl) new Chart(tEl, { type: 'bar', data: { labels: top.map(t => t[0]), datasets: [{ label: 'Chi phí BTBD', data: top.map(t => t[1]), backgroundColor: '#f59e0b', borderWidth: 0 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => fmtM(v) } } } } });

  renderCostPeriodChart();
}

// Chi phí vận hành theo kỳ (Tháng/Quý): cột chồng BTBD + Phạt nguội
function periodKey(v, period) {
  const mk = monthKeyFromDate(v);
  if (!mk) return null;
  if (period === 'quarter') { const parts = mk.split('-'); return parts[0] + '-Q' + Math.ceil(parseInt(parts[1], 10) / 3); }
  return mk;
}
function renderCostPeriodChart() {
  destroyChartIfExists('chartCostMonthly');
  destroyChartIfExists('chartCostBTBDPeriod');
  destroyChartIfExists('chartCostFinesPeriod');
  const period = window._costPeriod || 'month';
  const b = DATA.btbd || [], f = DATA.fines || [];
  const btbdBy = {}, fineBy = {}, finePaidBy = {}, fineUnpaidBy = {};
  b.forEach(x => { const k = periodKey(x.inDate, period); if (!k) return; btbdBy[k] = (btbdBy[k] || 0) + parseCost(x.cost); });
  f.forEach(x => {
    const k = periodKey(x.violationTime || x.reportDate, period); if (!k) return;
    const c = parseCost(x.cost);
    fineBy[k] = (fineBy[k] || 0) + c;
    if (finePaidClass(x) === 'paid') finePaidBy[k] = (finePaidBy[k] || 0) + c;
    else fineUnpaidBy[k] = (fineUnpaidBy[k] || 0) + c;
  });
  const allKeys = Array.from(new Set(Object.keys(btbdBy).concat(Object.keys(fineBy)))).sort();
  const keys = allKeys.slice(period === 'quarter' ? -12 : -18);
  const commonOpts = { responsive: true, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12 } } }, scales: { y: { ticks: { callback: v => fmtM(v) } } } };

  // Biểu đồ riêng: chi phí BTBD theo kỳ
  const elB = document.getElementById('chartCostBTBDPeriod');
  if (elB) new Chart(elB, {
    type: 'bar',
    data: { labels: keys, datasets: [ { label: 'Chi phí BTBD', data: keys.map(k => btbdBy[k] || 0), backgroundColor: '#8b5cf6', borderWidth: 0 } ] },
    options: commonOpts
  });

  // Biểu đồ riêng: chi phí Phạt nguội theo kỳ (tách Đã đóng / Chưa đóng)
  const elF = document.getElementById('chartCostFinesPeriod');
  if (elF) new Chart(elF, {
    type: 'bar',
    data: { labels: keys, datasets: [
      { label: 'Đã đóng phạt', data: keys.map(k => finePaidBy[k] || 0), backgroundColor: '#16a34a', borderWidth: 0, stack: 'fine' },
      { label: 'Chưa đóng', data: keys.map(k => fineUnpaidBy[k] || 0), backgroundColor: '#ef4444', borderWidth: 0, stack: 'fine' },
    ] },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12 } } }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: v => fmtM(v) } } } }
  });

  // Giữ tương thích: nếu còn canvas cũ (cache HTML) thì vẫn vẽ dạng chồng
  const el = document.getElementById('chartCostMonthly');
  if (el) new Chart(el, {
    type: 'bar',
    data: { labels: keys, datasets: [
      { label: 'Chi phí BTBD', data: keys.map(k => btbdBy[k] || 0), backgroundColor: '#8b5cf6', borderWidth: 0, stack: 'cost' },
      { label: 'Phạt nguội', data: keys.map(k => fineBy[k] || 0), backgroundColor: '#ef4444', borderWidth: 0, stack: 'cost' },
    ] },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12 } } }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: v => fmtM(v) } } } }
  });
}
function setCostPeriod(p) {
  window._costPeriod = p;
  document.querySelectorAll('.cost-period-btn').forEach(btn => {
    const on = btn.getAttribute('data-period') === p;
    btn.style.fontWeight = on ? '700' : '400';
    btn.style.color = on ? '#fff' : 'var(--text-secondary)';
    btn.style.background = on ? 'var(--accent)' : 'var(--bg-card)';
  });
  renderCostPeriodChart();
}

// ==================== PAGE: XU HƯỚNG (lịch sử chỉ số theo ngày) ====================
function computeMetricsSnapshot() {
  const v = DATA.vehicles || [], d = DATA.drivers || [], e = DATA.efficiency || [], f = DATA.fines || [], rf = DATA.reinforcement || [], b = DATA.btbd || [];
  const totalVeh = v.length, activeVeh = v.filter(x => x.status === 'Hoạt động').length;
  const op = e.filter(x => x.opStatus === 'Đang vận hành');
  const avgEff = op.length ? op.reduce((s, x) => s + (Number(x.efficiency) || 0), 0) / op.length : 0;
  const totalStaff = d.length, resigned = d.filter(x => x.status === 'Đã nghỉ việc').length;
  const pendingFines = f.filter(x => x.progress === 'Chưa Làm Việc Với Tài Xế' || x.progress === 'Pending').length;
  const reinfOK = rf.filter(x => x.status === 'Có xe').length;
  let expiring = 0;
  v.forEach(x => { ['inspectionExpiry', 'liabilityExpiry', 'roadFeeExpiry', 'badgeExpiry'].forEach(fl => { const st = isExpiringSoon(x[fl]); if (st === 'expired' || st === 'critical') expiring++; }); });
  return {
    avgEff: Math.round(avgEff * 10) / 10,
    activePct: totalVeh ? Math.round(activeVeh / totalVeh * 1000) / 10 : 0,
    resignPct: totalStaff ? Math.round(resigned / totalStaff * 1000) / 10 : 0,
    reinfPct: rf.length ? Math.round(reinfOK / rf.length * 1000) / 10 : 0,
    expiring: expiring, pendingFines: pendingFines,
    fineCost: f.reduce((s, x) => s + parseCost(x.cost), 0),
    btbdCost: b.reduce((s, x) => s + parseCost(x.cost), 0),
  };
}
function getMetricsHistory() { try { return JSON.parse(localStorage.getItem('metrics_history') || '{}'); } catch (e) { return {}; } }
function captureHistorySnapshot() {
  try {
    if (!(DATA.vehicles && DATA.vehicles.length)) return; // không lưu khi chưa có dữ liệu
    const hist = getMetricsHistory();
    const today = new Date().toISOString().slice(0, 10);
    hist[today] = computeMetricsSnapshot();
    const keys = Object.keys(hist).sort();
    while (keys.length > 120) { delete hist[keys.shift()]; }
    localStorage.setItem('metrics_history', JSON.stringify(hist));
  } catch (e) { console.warn('history capture', e); }
}
function renderTrends() {
  const hist = getMetricsHistory();
  const dates = Object.keys(hist).sort();
  const note = document.getElementById('trendNote');
  if (note) {
    note.textContent = dates.length < 2
      ? 'Đang tích lũy dữ liệu theo ngày — cần ít nhất 2 ngày để vẽ xu hướng (hiện có ' + dates.length + ' ngày). Dashboard tự lưu 1 điểm mỗi ngày khi đồng bộ.'
      : 'Dữ liệu xu hướng từ ' + dates[0] + ' đến ' + dates[dates.length - 1] + ' (' + dates.length + ' ngày).';
  }
  const tb = document.getElementById('trendTableBody');
  if (tb) tb.innerHTML = dates.slice().reverse().map(d => `<tr><td>${d}</td><td>${hist[d].avgEff}%</td><td>${hist[d].activePct}%</td><td>${hist[d].resignPct}%</td><td>${hist[d].pendingFines}</td><td>${fmt(hist[d].fineCost)}₫</td><td>${fmt(hist[d].btbdCost)}₫</td></tr>`).join('');
}
function renderTrendCharts() {
  destroyChartIfExists('chartTrendKPI');
  destroyChartIfExists('chartTrendCost');
  const hist = getMetricsHistory();
  const dates = Object.keys(hist).sort();
  const labels = dates.map(d => d.slice(5));
  const kEl = document.getElementById('chartTrendKPI');
  if (kEl) new Chart(kEl, {
    type: 'line', data: {
      labels: labels, datasets: [
        { label: 'Hiệu suất xe %', data: dates.map(d => hist[d].avgEff), borderColor: '#3b82f6', backgroundColor: '#3b82f6', tension: 0.3, fill: false, borderWidth: 2, pointRadius: 3 },
        { label: 'Đáp ứng tăng cường %', data: dates.map(d => hist[d].reinfPct), borderColor: '#10b981', backgroundColor: '#10b981', tension: 0.3, fill: false, borderWidth: 2, pointRadius: 3 },
        { label: 'Xe hoạt động %', data: dates.map(d => hist[d].activePct), borderColor: '#8b5cf6', backgroundColor: '#8b5cf6', tension: 0.3, fill: false, borderWidth: 2, pointRadius: 3 },
        { label: 'Nghỉ việc %', data: dates.map(d => hist[d].resignPct), borderColor: '#ef4444', backgroundColor: '#ef4444', tension: 0.3, fill: false, borderWidth: 2, pointRadius: 3 },
      ]
    }, options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12 } } }, scales: { y: { ticks: { callback: v => v + '%' } } } }
  });
  const cEl = document.getElementById('chartTrendCost');
  if (cEl) new Chart(cEl, {
    type: 'line', data: {
      labels: labels, datasets: [
        { label: 'Phạt nguội (triệu đ)', data: dates.map(d => Math.round(hist[d].fineCost / 1000000 * 10) / 10), borderColor: '#ef4444', backgroundColor: '#ef4444', tension: 0.3, fill: false, borderWidth: 2, pointRadius: 3 },
        { label: 'Chi phí BTBD (triệu đ)', data: dates.map(d => Math.round(hist[d].btbdCost / 1000000 * 10) / 10), borderColor: '#f59e0b', backgroundColor: '#f59e0b', tension: 0.3, fill: false, borderWidth: 2, pointRadius: 3 },
      ]
    }, options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12 } } } }
  });
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
  const opVehiclesDash = e.filter(x => x.opStatus === 'Đang vận hành');
  const avgEff = opVehiclesDash.length ? (opVehiclesDash.reduce((s,x) => s + x.efficiency, 0) / opVehiclesDash.length).toFixed(1) : 0;
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
// Phân loại đóng phạt: 'paid' = đã đóng (gồm eform hoàn ứng - đã nộp nhà nước), 'unpaid' = chưa đóng
function finePaidClass(x) {
  const p = String(x.progress || '').toLowerCase();
  if (!p) return 'unknown';
  if (p.indexOf('đã đóng') !== -1) return 'paid';
  if (p.indexOf('eform') !== -1) return 'paid';
  return 'unpaid';
}

function renderFines() {
  const f = DATA.fines;
  const progresses = {};
  f.forEach(x => { if(x.progress) progresses[x.progress]=(progresses[x.progress]||0)+1; });

  const plates = {};
  f.forEach(x => { const p = x.plate || 'N/A'; plates[p] = (plates[p] || 0) + 1; });
  const numVehicles = Object.keys(plates).length;

  let paidN = 0, paidC = 0, unpaidN = 0, unpaidC = 0, unknownN = 0;
  f.forEach(x => {
    const c = parseCost(x.cost);
    const cls = finePaidClass(x);
    if (cls === 'paid') { paidN++; paidC += c; }
    else if (cls === 'unpaid') { unpaidN++; unpaidC += c; }
    else unknownN++;
  });
  const totalCost = f.reduce((s,x) => s + (parseCost(x.cost)), 0);

  document.getElementById('finesKPIs').innerHTML = makeKPI([
    {l:'Tổng vụ / Số xe dính phạt', v:f.length + ' / ' + numVehicles, c:'blue', i:'🚨'},
    {l:'Tổng chi phí phạt', v:fmt(totalCost)+'₫', c:'purple', i:'💰'},
    {l:'Đã đóng phạt ('+paidN+' vụ)', v:fmt(paidC)+'₫', c:'green', i:'✅'},
    {l:'Chưa đóng ('+unpaidN+' vụ)', v:fmt(unpaidC)+'₫', c:'red', i:'⏳'},
    {l:'Tỷ lệ đã đóng (theo vụ)', v:(paidN+unpaidN)?Math.round(paidN*100/(paidN+unpaidN))+'%':'—', c:'orange', i:'📊'}
  ]);

  // Badge = số vụ chưa đóng phạt
  document.getElementById('finesBadge').textContent = unpaidN;
  document.getElementById('headerAlertBadge').textContent = unpaidN;

  populateSelect('filterFineProgress', Object.keys(progresses).sort());
  renderFinesByVehicle();
  renderFinesTable();
}

// Tổng hợp phạt nguội theo xe: số vụ, chi phí, đã đóng/chưa đóng
function renderFinesByVehicle() {
  const body = document.getElementById('finesByVehicleBody');
  if (!body) return;
  const byVeh = {};
  (DATA.fines || []).forEach(x => {
    const p = x.plate || 'N/A';
    const o = byVeh[p] || (byVeh[p] = { n: 0, cost: 0, paidN: 0, unpaidN: 0, unpaidCost: 0 });
    const c = parseCost(x.cost);
    o.n++; o.cost += c;
    const cls = finePaidClass(x);
    if (cls === 'paid') o.paidN++;
    else if (cls === 'unpaid') { o.unpaidN++; o.unpaidCost += c; }
  });
  const rows = Object.entries(byVeh).sort((a, b) => b[1].cost - a[1].cost);
  body.innerHTML = rows.map(([pl, o], i) => {
    const st = o.unpaidN === 0
      ? '<span class="status in_transit">Đã đóng đủ</span>'
      : '<span class="status delayed">Còn ' + o.unpaidN + ' vụ chưa đóng</span>';
    return '<tr><td>' + (i + 1) + '</td>' +
      '<td style="font-weight:600;color:var(--text-primary)">' + escapeHTML(pl) + '</td>' +
      '<td>' + o.n + '</td>' +
      '<td style="font-weight:600">' + fmt(o.cost) + '₫</td>' +
      '<td>' + o.paidN + '</td>' +
      '<td>' + o.unpaidN + '</td>' +
      '<td style="font-weight:600;color:' + (o.unpaidCost > 0 ? 'var(--danger)' : 'var(--text-muted)') + '">' + fmt(o.unpaidCost) + '₫</td>' +
      '<td>' + st + '</td></tr>';
  }).join('');
}

function renderFinesTable() {
  const progF = document.getElementById('filterFineProgress').value;
  let data = DATA.fines;
  if (progF) data = data.filter(x => x.progress === progF);

  document.getElementById('finesTableBody').innerHTML = data.map(x => {
    const paidCls = finePaidClass(x);
    const pCls = paidCls==='paid' ? 'in_transit' : (x.progress==='Đang Xử Lý Với Tài Xế' ? 'unassigned' : 'delayed');
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
  // Hiệu suất TB: chỉ tính xe đang vận hành (cột P); các trạng thái khác vẫn hiển thị ở bảng chi tiết
  const opVehicles = e.filter(x => x.opStatus === 'Đang vận hành');
  const avgEff = opVehicles.length ? (opVehicles.reduce((s,x)=>s+x.efficiency,0)/opVehicles.length).toFixed(1) : 0;

  // Cột mới từ sheet cập nhật: tổng KM và thời gian chạy
  const kmList = e.map(x => x.totalKm).filter(v => typeof v === 'number');
  const totalKm = kmList.reduce((s, v) => s + v, 0);
  const avgKm = kmList.length ? totalKm / kmList.length : 0;

  document.getElementById('efficiencyKPIs').innerHTML = makeKPI([
    {l:'Tổng xe', v:e.length, c:'blue', i:'🚛'},
    {l:'Đang vận hành', v:operating, c:'green', i:'✅'},
    {l:'Đề xuất thanh lý', v:opStats['Đề xuất thanh lý']||0, c:'orange', i:'📋'},
    {l:'BTBD/Tai nạn', v:(opStats['BTBD nặng']||0)+(opStats['Xe bị tai nạn']||0)+(opStats['Xe tai nạn']||0), c:'red', i:'🔧'},
    {l:'Hiệu suất TB', v:avgEff+'%', c:'purple', i:'📊'},
    {l:'Tổng KM đã chạy', v:fmt(totalKm)+' km', c:'cyan', i:'🛣️'},
    {l:'KM bình quân/xe', v:fmt(avgKm)+' km', c:'blue', i:'📏'}
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
      <td>${escapeHTML(x.depot||'')}</td>
      <td>${escapeHTML(x.runTime||'')}</td>
      <td style="font-weight:600">${x.totalKm != null ? fmt(x.totalKm) : ''}</td>
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
  renderReinfSummary();
}

// ==== TỔNG HỢP TĂNG CƯỜNG THEO KỲ (Ngày/Tuần/Tháng) ====
window._reinfSummaryMode = window._reinfSummaryMode || 'week';

function setReinfSummaryMode(m) {
  window._reinfSummaryMode = m;
  renderReinfSummary();
}

// Lấy ngày phát sinh ticket: ưu tiên Timestamp (đồng bộ Sheet), fallback requestDate ISO (data.js)
// LƯU Ý dữ liệu gốc: trên Sheet, Timestamp nhập dd/mm nhưng Google hiểu nhầm mm/dd với ngày <=12
// => ô bị ép thành DATE (serial) với ngày/tháng ĐẢO; ngày >12 giữ nguyên TEXT dd/mm (đúng).
// Quy tắc khôi phục: chuỗi -> đọc dd/mm; serial -> đảo ngược ngày<->tháng.
function reinfDateOf(x) {
  var v = x.ts;
  if (v != null && v !== '') {
    if (typeof v === 'number' || (/^\d+(\.\d+)?$/.test(String(v).trim()) && Number(v) > 20000)) {
      var dt = new Date(Math.round((Number(v) - 25569) * 86400000));
      if (!isNaN(dt)) {
        var Y = dt.getUTCFullYear(), M = dt.getUTCMonth() + 1, D = dt.getUTCDate();
        if (D <= 12) return new Date(Y, D - 1, M); // đảo lại về ngày thật
        return new Date(Y, M - 1, D); // phòng hờ: serial hợp lệ hiếm gặp
      }
    }
    var m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  }
  var r = String(x.requestDate || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (r) return new Date(+r[1], +r[2] - 1, +r[3]);
  return null;
}

function reinfISOWeek(d) {
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  var wk = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return { year: t.getUTCFullYear(), week: wk };
}

function renderReinfSummary() {
  var body = document.getElementById('reinfSummaryBody');
  if (!body) return;
  var mode = window._reinfSummaryMode;

  // nút active
  document.querySelectorAll('.reinf-period-btn').forEach(function (b) {
    var on = b.dataset.period === mode;
    b.style.cssText = 'padding:6px 12px;font-size:12px;border-radius:6px;border:1px solid var(--border-color);cursor:pointer;font-weight:' +
      (on ? '700;background:var(--accent);color:#fff' : '400;background:var(--bg-card);color:var(--text-secondary)');
  });

  var groups = {}; // key -> {label, sortKey, t, ok, no, cancel}
  (DATA.reinforcement || []).forEach(function (x) {
    var d = reinfDateOf(x);
    if (!d) return;
    var key, label, sortKey;
    if (mode === 'day') {
      sortKey = d.getTime(); key = d.toISOString().slice(0, 10);
      label = ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
    } else if (mode === 'week') {
      var iw = reinfISOWeek(d);
      key = iw.year + '-W' + ('0' + iw.week).slice(-2);
      var mon = new Date(d); var wd = (d.getDay() || 7); mon.setDate(d.getDate() - wd + 1);
      var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      sortKey = mon.getTime();
      label = 'W' + ('0' + iw.week).slice(-2) + ' (' + ('0' + mon.getDate()).slice(-2) + '/' + ('0' + (mon.getMonth() + 1)).slice(-2) +
        '–' + ('0' + sun.getDate()).slice(-2) + '/' + ('0' + (sun.getMonth() + 1)).slice(-2) + ')';
    } else {
      key = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
      sortKey = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      label = ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
    }
    var g = groups[key] || (groups[key] = { label: label, sortKey: sortKey, t: 0, ok: 0, no: 0, cancel: 0 });
    g.t++;
    var st = String(x.status || '');
    if (/^có xe/i.test(st)) g.ok++;
    else if (/^không có xe/i.test(st)) g.no++;
    else if (/^hủy/i.test(st)) g.cancel++;
  });

  var list = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return a.sortKey - b.sortKey; });
  if (!list.length) { body.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted)">Chưa có dữ liệu</td></tr>'; return; }

  // tính Δ theo thứ tự thời gian
  list.forEach(function (g, i) {
    g.real = g.ok + g.no;
    g.rate = g.real ? g.ok / g.real : null;
    var p = list[i - 1];
    g.dT = p ? g.t - p.t : null;
    g.dRate = (p && p.rate != null && g.rate != null) ? (g.rate - p.rate) * 100 : null;
  });

  var totalRow = list.reduce(function (s, g) { s.t += g.t; s.ok += g.ok; s.no += g.no; s.cancel += g.cancel; return s; }, { t: 0, ok: 0, no: 0, cancel: 0 });
  totalRow.real = totalRow.ok + totalRow.no;
  totalRow.rate = totalRow.real ? totalRow.ok / totalRow.real : null;

  function rateCell(r) {
    if (r == null) return '<td>—</td>';
    var pct = (r * 100).toFixed(1) + '%';
    var col = r >= 0.9 ? 'var(--success)' : (r >= 0.8 ? 'var(--warning)' : 'var(--danger)');
    return '<td style="font-weight:700;color:' + col + '">' + pct + '</td>';
  }
  function deltaCell(v, suffix) {
    if (v == null) return '<td>—</td>';
    var s = (v > 0 ? '+' : '') + (suffix ? v.toFixed(1) : v);
    var col = v > 0 ? 'var(--success)' : (v < 0 ? 'var(--danger)' : 'var(--text-muted)');
    return '<td style="color:' + col + ';font-weight:600">' + s + (suffix || '') + '</td>';
  }

  // hiển thị kỳ mới nhất trước
  var html = list.slice().reverse().map(function (g) {
    return '<tr><td style="font-weight:600">' + escapeHTML(g.label) + '</td>' +
      '<td>' + g.t + '</td><td>' + g.ok + '</td><td>' + g.no + '</td><td>' + g.cancel + '</td><td>' + g.real + '</td>' +
      rateCell(g.rate) + deltaCell(g.dT, '') + deltaCell(g.dRate, ' đ%') + '</tr>';
  }).join('');
  html += '<tr style="background:var(--accent-light)"><td style="font-weight:800">TỔNG</td>' +
    '<td style="font-weight:800">' + totalRow.t + '</td><td style="font-weight:800">' + totalRow.ok + '</td>' +
    '<td style="font-weight:800">' + totalRow.no + '</td><td style="font-weight:800">' + totalRow.cancel + '</td>' +
    '<td style="font-weight:800">' + totalRow.real + '</td>' + rateCell(totalRow.rate) + '<td>—</td><td>—</td></tr>';
  body.innerHTML = html;
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
// ==================== PAGE: ONTIME XE TẢI (dữ liệu theo chuyến) ====================
// Dữ liệu nguồn: DATA.ontime.trips = [{date, trip, schedule, route, tonnage, driver,
// plate, partner, onCheckin, stops, rate}]. Tổng hợp theo Ngày / Tuần / Quý / Năm.
window._ontimePeriod = window._ontimePeriod || 'day';

function setOntimePeriod(p) {
  window._ontimePeriod = p;
  renderOntime();
  renderOntimeCharts();
}

function otPct(v) { return (typeof v === 'number') ? (v * 100).toFixed(1) + '%' : '-'; }

function otISOWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { year: t.getUTCFullYear(), week: Math.ceil(((t - y0) / 86400000 + 1) / 7) };
}

// Gộp chuyến theo kỳ -> [{key, label, sortKey, trips, stops, on, late, rate}]
function ontimeByPeriod(period) {
  const trips = (DATA.ontime && DATA.ontime.trips) || [];
  const g = {};
  trips.forEach(x => {
    if (!x.date) return;
    const parts = x.date.split('-');
    const d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    if (isNaN(d)) return;
    let key, label, sortKey;
    if (period === 'day') {
      key = x.date; sortKey = d.getTime();
      label = parts[2] + '/' + parts[1] + '/' + parts[0];
    } else if (period === 'week') {
      const iw = otISOWeek(d);
      key = iw.year + '-W' + ('0' + iw.week).slice(-2);
      const mon = new Date(d); mon.setDate(d.getDate() - (d.getDay() || 7) + 1);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      sortKey = mon.getTime();
      label = 'W' + ('0' + iw.week).slice(-2) + ' (' + ('0' + mon.getDate()).slice(-2) + '/' + ('0' + (mon.getMonth() + 1)).slice(-2) +
        '–' + ('0' + sun.getDate()).slice(-2) + '/' + ('0' + (sun.getMonth() + 1)).slice(-2) + ')';
    } else if (period === 'quarter') {
      const q = Math.floor(d.getMonth() / 3) + 1;
      key = d.getFullYear() + '-Q' + q; sortKey = new Date(d.getFullYear(), (q - 1) * 3, 1).getTime();
      label = 'Q' + q + '/' + d.getFullYear();
    } else {
      key = String(d.getFullYear()); sortKey = new Date(d.getFullYear(), 0, 1).getTime();
      label = 'Năm ' + d.getFullYear();
    }
    const o = g[key] || (g[key] = { key, label, sortKey, trips: 0, stops: 0, on: 0 });
    o.trips++; o.stops += (x.stops || 0); o.on += (x.onCheckin || 0);
  });
  const list = Object.keys(g).map(k => g[k]).sort((a, b) => a.sortKey - b.sortKey);
  list.forEach(o => { o.late = o.stops - o.on; o.rate = o.stops ? o.on / o.stops : null; });
  return list;
}

function renderOntime() {
  const el = document.getElementById('ontimeKPIs');
  if (!el) return;
  const trips = (DATA.ontime && DATA.ontime.trips) || [];
  const period = window._ontimePeriod || 'day';

  // nút kỳ đang chọn
  document.querySelectorAll('.ot-period-btn').forEach(b => {
    const on = b.dataset.period === period;
    b.style.cssText = 'padding:6px 12px;font-size:12px;border-radius:6px;border:1px solid var(--border-color);cursor:pointer;font-weight:' +
      (on ? '700;background:var(--accent);color:#fff' : '400;background:var(--bg-card);color:var(--text-secondary)');
  });

  if (!trips.length) {
    el.innerHTML = makeKPI([{ l: 'Ontime', v: 'Chưa có dữ liệu', c: 'blue', i: '⏱️' }]);
    const b = document.getElementById('ontimeTableBody');
    if (b) b.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Chưa có dữ liệu — hãy bấm "Đồng bộ trực tuyến"</td></tr>';
    return;
  }

  const totStops = trips.reduce((s, x) => s + (x.stops || 0), 0);
  const totOn = trips.reduce((s, x) => s + (x.onCheckin || 0), 0);
  const overall = totStops ? totOn / totStops : null;
  const list = ontimeByPeriod(period);
  const cur = list[list.length - 1] || null;
  const prev = list.length > 1 ? list[list.length - 2] : null;
  const diff = (cur && prev && cur.rate != null && prev.rate != null) ? (cur.rate - prev.rate) * 100 : null;
  const dates = trips.map(x => x.date).filter(Boolean).sort();

  const kpis = [
    { l: 'Ontime toàn kỳ', v: otPct(overall), c: overall >= 0.95 ? 'green' : overall >= 0.9 ? 'orange' : 'red', i: '⏱️' },
    { l: 'Tổng chuyến', v: fmt(trips.length), c: 'blue', i: '🚚' },
    { l: 'Điểm dừng / Đúng giờ', v: fmt(totStops) + ' / ' + fmt(totOn), c: 'cyan', i: '📍' },
    { l: 'Số điểm TRỄ', v: fmt(totStops - totOn), c: 'red', i: '⚠️' },
  ];
  if (cur) kpis.push({ l: 'Kỳ mới nhất: ' + cur.label, v: otPct(cur.rate), c: cur.rate >= 0.95 ? 'green' : cur.rate >= 0.9 ? 'orange' : 'red', i: '📅' });
  if (diff != null) kpis.push({ l: 'So kỳ trước (' + prev.label + ')', v: (diff >= 0 ? '+' : '') + diff.toFixed(1) + ' điểm %', c: diff >= 0 ? 'green' : 'red', i: diff >= 0 ? '📈' : '📉' });
  el.innerHTML = makeKPI(kpis);

  const lb = document.getElementById('ontimePeriodLabel');
  if (lb) lb.textContent = '— dữ liệu ' + (dates[0] || '') + ' đến ' + (dates[dates.length - 1] || '') + ', ' + list.length + ' kỳ';

  // bảng: kỳ mới nhất lên đầu
  const body = document.getElementById('ontimeTableBody');
  if (body) {
    const rev = list.slice().reverse();
    body.innerHTML = rev.map((o, idx) => {
      const p = rev[idx + 1]; // kỳ liền trước (do đã đảo thứ tự)
      const d = (p && o.rate != null && p.rate != null) ? (o.rate - p.rate) * 100 : null;
      const cls = o.rate == null ? '' : o.rate >= 0.95 ? 'assigned' : o.rate >= 0.9 ? 'unassigned' : 'breakdown';
      const dTxt = d == null ? '—' : '<span style="color:' + (d >= 0 ? 'var(--success)' : 'var(--danger)') + ';font-weight:700">' + (d >= 0 ? '+' : '') + d.toFixed(1) + ' đ%</span>';
      return '<tr><td style="font-weight:600;color:var(--text-primary)">' + escapeHTML(o.label) + '</td>' +
        '<td>' + fmt(o.trips) + '</td><td>' + fmt(o.stops) + '</td><td>' + fmt(o.on) + '</td>' +
        '<td style="color:' + (o.late > 0 ? 'var(--danger)' : 'var(--text-muted)') + ';font-weight:600">' + fmt(o.late) + '</td>' +
        '<td><span class="status ' + cls + '">' + otPct(o.rate) + '</span></td>' +
        '<td>' + dTxt + '</td></tr>';
    }).join('');
  }
}

function renderOntimeCharts() {
  destroyChartIfExists('chartOntimeTrend');
  destroyChartIfExists('chartOntimeCompare');
  destroyChartIfExists('chartOntimePartner');
  destroyChartIfExists('chartOntimeWorst');
  destroyChartIfExists('chartOntimeGroup');
  const trips = (DATA.ontime && DATA.ontime.trips) || [];
  if (!trips.length) return;
  const period = window._ontimePeriod || 'day';
  const list = ontimeByPeriod(period);
  const show = list.slice(period === 'day' ? -30 : period === 'week' ? -16 : -12);
  const labels = show.map(o => o.label);

  // 1) Xu hướng % ontime theo kỳ + đường mục tiêu 95%
  const trendEl = document.getElementById('chartOntimeTrend');
  if (trendEl) new Chart(trendEl, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: '% Ontime', data: show.map(o => o.rate == null ? null : Math.round(o.rate * 1000) / 10), borderColor: '#17a398', backgroundColor: 'rgba(23,163,152,.18)', tension: .3, fill: true, borderWidth: 3, pointRadius: 3 },
        { label: 'Mục tiêu 95%', data: show.map(() => 95), borderColor: '#dc2626', borderDash: [6, 4], borderWidth: 2, pointRadius: 0, fill: false }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12 } } }, scales: { y: { ticks: { callback: v => v + '%' } } } }
  });

  // 2) So sánh khối lượng: đúng giờ vs trễ (cột chồng)
  const cmpEl = document.getElementById('chartOntimeCompare');
  if (cmpEl) new Chart(cmpEl, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Đúng giờ', data: show.map(o => o.on), backgroundColor: '#16a34a', stack: 'ot', borderWidth: 0 },
        { label: 'Trễ', data: show.map(o => o.late), backgroundColor: '#dc2626', stack: 'ot', borderWidth: 0 }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12 } } }, scales: { x: { stacked: true }, y: { stacked: true } } }
  });

  // Chỉ lấy chuyến thuộc kỳ mới nhất cho 2 biểu đồ dưới
  const curKey = list.length ? list[list.length - 1].key : null;
  function keyOf(x) {
    if (!x.date) return null;
    const p = x.date.split('-'); const d = new Date(+p[0], +p[1] - 1, +p[2]);
    if (period === 'day') return x.date;
    if (period === 'week') { const iw = otISOWeek(d); return iw.year + '-W' + ('0' + iw.week).slice(-2); }
    if (period === 'quarter') return d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1);
    return String(d.getFullYear());
  }
  const curTrips = trips.filter(x => keyOf(x) === curKey);

  // 3) Ontime theo Đối tác
  const byP = {};
  curTrips.forEach(x => { const k = x.partner || '(Chưa gán)'; const o = byP[k] || (byP[k] = { on: 0, st: 0 }); o.on += x.onCheckin || 0; o.st += x.stops || 0; });
  const pRows = Object.keys(byP).map(k => ({ k, r: byP[k].st ? byP[k].on / byP[k].st * 100 : 0, st: byP[k].st }))
    .filter(x => x.st >= 5).sort((a, b) => b.st - a.st).slice(0, 10);
  const pEl = document.getElementById('chartOntimePartner');
  if (pEl && pRows.length) new Chart(pEl, {
    type: 'bar',
    data: { labels: pRows.map(x => x.k), datasets: [{ label: '% Ontime', data: pRows.map(x => Math.round(x.r * 10) / 10), backgroundColor: pRows.map(x => x.r >= 95 ? '#16a34a' : x.r >= 90 ? '#d97706' : '#dc2626'), borderRadius: 6 }] },
    options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: v => v + '%' } } } }
  });

  // 4) Top tuyến/lịch tải trễ nhiều nhất
  const byS = {};
  curTrips.forEach(x => { const k = x.schedule || '(Không rõ)'; const o = byS[k] || (byS[k] = { late: 0 }); o.late += (x.stops || 0) - (x.onCheckin || 0); });
  const sRows = Object.keys(byS).map(k => ({ k, late: byS[k].late })).filter(x => x.late > 0).sort((a, b) => b.late - a.late).slice(0, 10);
  const wEl = document.getElementById('chartOntimeWorst');
  if (wEl && sRows.length) new Chart(wEl, {
    type: 'bar',
    data: { labels: sRows.map(x => x.k), datasets: [{ label: 'Số điểm trễ', data: sRows.map(x => x.late), backgroundColor: '#dc2626', borderRadius: 6 }] },
    options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } } }
  });
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

// ---- BTBD theo kỳ (Ngày/Tuần/Quý/Năm) ----
window._btbdPeriod = window._btbdPeriod || 'week';
function setBtbdPeriod(p) { window._btbdPeriod = p; renderBTBDPeriodChart(); }

function btbdParseDate(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(s); return isNaN(d) ? null : d;
}

function renderBTBDPeriodChart() {
  destroyChartIfExists('chartBTBDPeriod');
  const period = window._btbdPeriod || 'week';
  document.querySelectorAll('.bt-period-btn').forEach(b => {
    const on = b.dataset.period === period;
    b.style.cssText = 'padding:6px 12px;font-size:12px;border-radius:6px;border:1px solid var(--border-color);cursor:pointer;font-weight:' +
      (on ? '700;background:var(--accent);color:#fff' : '400;background:var(--bg-card);color:var(--text-secondary)');
  });
  const el = document.getElementById('chartBTBDPeriod');
  if (!el) return;
  const g = {};
  (DATA.btbd || []).forEach(x => {
    const d = btbdParseDate(x.inDate); if (!d) return;
    let key, label, sortKey;
    if (period === 'day') {
      key = d.toISOString().slice(0, 10); sortKey = d.getTime();
      label = ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2);
    } else if (period === 'week') {
      const iw = otISOWeek(d); key = iw.year + '-W' + ('0' + iw.week).slice(-2);
      const mon = new Date(d); mon.setDate(d.getDate() - (d.getDay() || 7) + 1);
      sortKey = mon.getTime(); label = 'W' + ('0' + iw.week).slice(-2) + '/' + iw.year;
    } else if (period === 'quarter') {
      const q = Math.floor(d.getMonth() / 3) + 1; key = d.getFullYear() + '-Q' + q;
      sortKey = new Date(d.getFullYear(), (q - 1) * 3, 1).getTime(); label = 'Q' + q + '/' + d.getFullYear();
    } else {
      key = String(d.getFullYear()); sortKey = new Date(d.getFullYear(), 0, 1).getTime(); label = 'Năm ' + d.getFullYear();
    }
    const o = g[key] || (g[key] = { label, sortKey, n: 0, cost: 0 });
    o.n++; o.cost += parseCost(x.cost);
  });
  const list = Object.keys(g).map(k => g[k]).sort((a, b) => a.sortKey - b.sortKey)
    .slice(period === 'day' ? -30 : period === 'week' ? -16 : -12);
  if (!list.length) return;
  new Chart(el, {
    data: {
      labels: list.map(o => o.label),
      datasets: [
        { type: 'bar', label: 'Chi phí (triệu đ)', data: list.map(o => Math.round(o.cost / 1000000 * 10) / 10), backgroundColor: '#8b5cf6', borderWidth: 0, yAxisID: 'y' },
        { type: 'line', label: 'Số lượt vào xưởng', data: list.map(o => o.n), borderColor: '#2fd4c4', backgroundColor: '#2fd4c4', borderWidth: 3, tension: .3, pointRadius: 3, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12 } } },
      scales: {
        y: { position: 'left', title: { display: true, text: 'Chi phí (triệu đ)' } },
        y1: { position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Số lượt' } }
      }
    }
  });
}

function renderBTBDCharts() {
  destroyChartIfExists('chartBTBDContent');
  destroyChartIfExists('chartBTBDTop');
  renderBTBDPeriodChart();
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
    'chartBTBDContent', 'chartBTBDTop',
    'chartCostStructure', 'chartCostTopVeh', 'chartCostMonthly', 'chartTrendKPI', 'chartTrendCost'
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

// Chuẩn hóa số điện thoại: khôi phục số 0 đầu bị mất khi Sheet đọc SĐT dưới dạng số
function serPhone(val) {
  let s = ser(val);
  if (s === null || s === undefined) return s;
  s = String(s).replace(/\s|\.|-/g, '');
  if (/^\d{9}$/.test(s)) s = '0' + s; // 9 chữ số -> thêm 0 đầu (SĐT di động VN 10 số)
  return s;
}

// ===== Tra cột theo TÊN TIÊU ĐỀ (miễn nhiễm khi Sheet chèn/đổi thứ tự cột) =====
function normHdr(v){ return String(v == null ? '' : v).normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' '); }
function buildColMap(rows){
  const header = (rows && rows[0]) ? rows[0] : [];
  const map = {};
  for (let i = 0; i < header.length; i++){
    const k = normHdr(header[i]);
    if (k !== '' && !(k in map)) map[k] = i; // trùng tên -> giữ cột xuất hiện đầu tiên
  }
  return map;
}
function colIdx(cmap, names){
  const arr = Array.isArray(names) ? names : [names];
  for (const n of arr){ const k = normHdr(n); if (k in cmap) return cmap[k]; }
  return -1;
}
function cellRaw(row, cmap, names){ const i = colIdx(cmap, names); return i >= 0 ? row[i] : null; }
function cellS(row, cmap, names){ const i = colIdx(cmap, names); return i >= 0 ? ser(row[i]) : null; }

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
  const defaultId = '12Pe7N5dByhBw2XF4pZOkEgYb7_F14NgQlryhdhUlGf8';
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
  // headers=1: buộc Google chỉ coi DÒNG 1 là tiêu đề. Nếu không có tham số này, gviz tự
  // suy luận và gộp nhiều dòng đầu vào header khi mọi cột đều là chữ (làm mất dữ liệu).
  const url = 'https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=out:csv&headers=1&sheet=' + encodeURIComponent(name);
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
  const defaultUrl = 'https://docs.google.com/spreadsheets/d/12Pe7N5dByhBw2XF4pZOkEgYb7_F14NgQlryhdhUlGf8/edit?gid=898711822';
  const currentUrl = localStorage.getItem('custom_sheet_url') || defaultUrl;
  window.open(currentUrl, '_blank');

}

function processAndApplyWorkbook(workbook) {
  // 1. VEHICLES (Thông tin xe)
  const vSheet = workbook.Sheets['Thông tin xe'];
  const vRows = XLSX.utils.sheet_to_json(vSheet, {header: 1, raw: true, defval: null});
  const vMap = buildColMap(vRows);
  const vehicles = [];
  for (let i = 1; i < vRows.length; i++) {
    const row = vRows[i] || [];
    const plate = cellS(row, vMap, 'Biển số');
    if (!plate) continue;
    vehicles.push({
      stt: cellS(row, vMap, 'STT'),
      plate: plate,
      tonnage: cellS(row, vMap, 'Tải trọng'),
      model: cellS(row, vMap, 'Model'),
      region: cellS(row, vMap, 'Khu vực'),
      department: cellS(row, vMap, ['Bộ phận quản lý', 'Bộ phận']),
      boxVolume: cellS(row, vMap, 'Thể tích thùng'),
      yearReceived: cellS(row, vMap, 'Năm nhận xe'),
      yearsUsed: cellS(row, vMap, 'Số năm đã dùng'),
      condition: cellS(row, vMap, 'Tình trạng xe'),
      status: cellS(row, vMap, 'Tình trạng'),
      insuranceExpiry: cellS(row, vMap, 'Hạn BH vật chất'),
      inspectionCode: cellS(row, vMap, 'Mã đăng kiểm'),
      inspectionExpiry: cellS(row, vMap, 'Hạn đăng kiểm'),
      liabilityExpiry: cellS(row, vMap, 'Hạn bảo hiểm dân sự'),
      roadFeeExpiry: cellS(row, vMap, 'Hạn phí đường bộ'),
      badgeExpiry: cellS(row, vMap, 'Hạn phù hiệu'),
      regCertExpiry: cellS(row, vMap, 'Hạn giấy đăng ký'),
      totalKm: cellS(row, vMap, ['Tổng KM đã chạy', 'Tổng KM']),
      warning: cellS(row, vMap, 'Cảnh báo'),
      note: cellS(row, vMap, 'Ghi chú'),
      fleet: cellS(row, vMap, 'Đội xe'),
    });
  }

  // 2. ROUTES (Lịch tải)
  const rSheet = workbook.Sheets['Lịch tải'];
  const rRows = XLSX.utils.sheet_to_json(rSheet, {header: 1, raw: true, defval: null});
  const rMap = buildColMap(rRows);
  const routes = [];
  for (let i = 1; i < rRows.length; i++) {
    const row = rRows[i] || [];
    const rname = cellS(row, rMap, 'Tên tuyến');
    if (!rname) continue;
    routes.push({
      routeName: rname,
      tonnage: cellS(row, rMap, 'Tải trọng'),
      id: cellS(row, rMap, 'ID'),
      warehouse: cellS(row, rMap, ['Tên kho', 'Tên kho/BC', 'Kho/BC']),
      type: cellS(row, rMap, 'Loại hình'),                 // Phân loại/Giao/Lấy
      arrival: cellS(row, rMap, 'Tới điểm'),
      departure: cellS(row, rMap, 'Rời điểm'),
      note: cellS(row, rMap, ['Loại tuyến', 'Ghi chú']),   // hiển thị tại cột Ghi chú
      km: cellS(row, rMap, 'Km'),                          // tự có nếu Sheet thêm lại
      supplier: cellS(row, rMap, ['NCC', 'Tên NCC']),      // tự có nếu Sheet thêm lại
    });
  }

  // 3. FINES (Phạt nguội)
  const fSheet = workbook.Sheets['Phạt nguội'];
  const fRows = XLSX.utils.sheet_to_json(fSheet, {header: 1, raw: true, defval: null});
  const fMap = buildColMap(fRows);
  // Sheet có 2 cột trùng tên "Tình trạng": cột 1 = tình trạng tài xế, cột 2 = tiến độ đóng phạt.
  // buildColMap giữ cột đầu, nên dò riêng cột "Tình trạng" CUỐI CÙNG cho tiến độ.
  const fHdr = fRows[0] || [];
  let fProgressCol = -1;
  for (let c = 0; c < fHdr.length; c++) { if (normHdr(fHdr[c]) === 'tình trạng') fProgressCol = c; }
  const fDriverStatusCol = (function(){ for (let c = 0; c < fHdr.length; c++) { if (normHdr(fHdr[c]) === 'tình trạng') return c; } return -1; })();
  if (fProgressCol === fDriverStatusCol) fProgressCol = -1; // chỉ có 1 cột -> không dùng
  const fines = [];
  for (let i = 1; i < fRows.length; i++) {
    const row = fRows[i] || [];
    const plate = cellS(row, fMap, 'BKS');
    if (!plate) continue;
    fines.push({
      reportDate: cellS(row, fMap, 'Ngày SUP cập nhật vi phạm'),
      plate: plate,
      depot: cellS(row, fMap, 'Kho Quản Lý'),
      violationTime: cellS(row, fMap, ['violation_time', 'Thời gian vi phạm']),
      location: cellS(row, fMap, 'Nơi vi phạm'),
      violation: cellS(row, fMap, 'Lỗi vi phạm'),
      cost: cellS(row, fMap, 'Chi phí dự kiến'),
      sup: cellS(row, fMap, 'SUP phụ trách'),
      driverId: cellS(row, fMap, 'MSNV'),
      driverName: cellS(row, fMap, 'Tài Xế'),
      driverStatus: cellS(row, fMap, 'Tình Trạng'),
      expectedDate: cellS(row, fMap, ['Ngày dự kiến xử lý xong (15 ngày)', 'Ngày dự kiến xử lý xong']),
      progress: fProgressCol >= 0 ? ser(row[fProgressCol]) : cellS(row, fMap, 'Tiến Độ'),
    });
  }

  // 4. EFFICIENCY (Hiệu suất sử dụng xe)
  const eSheet = workbook.Sheets['Hiệu suất sử dụng xe'];
  const eRows = XLSX.utils.sheet_to_json(eSheet, {header: 1, raw: true, defval: null});
  const eMap = buildColMap(eRows);
  const efficiency = [];
  for (let i = 1; i < eRows.length; i++) {
    const row = eRows[i] || [];
    const plate = cellS(row, eMap, ['Biển số', 'BIỂN SỐ XE', 'BKS']);
    if (!plate) continue;
    const effVal = cellRaw(row, eMap, ['HIỆU SUẤT SỬ DỤNG', 'Hiệu suất sử dụng xe', 'Hiệu suất']);
    let numEff = 0;
    if (typeof effVal === 'number') {
      // <=1: giá trị dạng phân số (0.28) -> nhân 100; >1: đã là % sẵn (28.01) -> giữ nguyên
      numEff = effVal <= 1 ? effVal * 100 : effVal;
      numEff = Math.round(numEff * 10) / 10;
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
      stt: cellS(row, eMap, 'STT'),
      plate: plate,
      tonnage: cellS(row, eMap, 'Tải trọng'),
      model: cellS(row, eMap, 'Model'),
      region: cellS(row, eMap, ['KHU VỰC', 'Khu vực']),
      department: cellS(row, eMap, ['Bộ phận quản lý', 'Bộ phận']),
      yearsUsed: cellS(row, eMap, 'Số năm đã dùng'),
      condition: cellS(row, eMap, 'Tình trạng xe'),
      status: cellS(row, eMap, 'Tình trạng'),
      vehicleType: cellS(row, eMap, ['LOẠI XE', 'Loại xe']),
      efficiency: numEff,
      opStatus: cellS(row, eMap, ['Tình trạng vận hành', 'TÌNH TRẠNG VẬN HÀNH']),
      // ---- cột mới trong sheet cập nhật ----
      runTime: cellS(row, eMap, ['TỔNG THỜI GIAN CHẠY', 'Tổng thời gian chạy']),
      totalKm: (function () {
        var v = cellRaw(row, eMap, ['TỔNG SỐ KM', 'Tổng số km']);
        if (typeof v === 'number') return v;
        var n = parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
        return isNaN(n) ? null : n;
      })(),
      depot: cellS(row, eMap, ['Kho quản lý', 'KHO QUẢN LÝ']),
    });
  }

  // 5. DRIVERS (Nhân sự)
  const dSheet = workbook.Sheets['Nhân sự'] || workbook.Sheets['Tài xế'];
  const dRows = XLSX.utils.sheet_to_json(dSheet, {header: 1, raw: true, defval: null});
  const dMap = buildColMap(dRows);
  const drivers = [];
  for (let i = 1; i < dRows.length; i++) {
    const row = dRows[i] || [];
    const name = cellS(row, dMap, ['Thông tin nhân viên', 'Họ tên', 'Tên nhân viên']);
    if (!name) continue;
    drivers.push({
      stt: cellS(row, dMap, 'STT'),
      employeeId: cellS(row, dMap, ['MSSV', 'MSNV']),
      name: name,
      phone: serPhone(cellRaw(row, dMap, ['Số điện thoại', 'SĐT'])),
      position: cellS(row, dMap, ['Vị trí', 'Chức danh']),
      unit: cellS(row, dMap, 'Đơn vị'),
      supervisor: cellS(row, dMap, ['Quản lý trực tiếp', 'Quản lý']),
      shift: cellS(row, dMap, 'Ca làm'),
      route: cellS(row, dMap, ['Tuyến chạy', 'Tuyến']),
      startDate: cellS(row, dMap, 'Ngày vào làm'),
      endDate: cellS(row, dMap, 'Ngày nghỉ việc'),
      status: cellS(row, dMap, 'Tình trạng'),
      seniority: cellS(row, dMap, 'Thâm niên'),
      seniorityDetail: cellS(row, dMap, ['Thâm niên 1', 'Thâm niên chi tiết']),
    });
  }

  // 6. REINFORCEMENT (Tải tăng cường Lấy)
  const rfSheet = workbook.Sheets['Tải tăng cường Lấy'];
  const rfRows = XLSX.utils.sheet_to_json(rfSheet, {header: 1, raw: true, defval: null});
  const rfMap = buildColMap(rfRows);
  const reinforcement = [];
  for (let i = 1; i < rfRows.length; i++) {
    const row = rfRows[i] || [];
    const tid = cellS(row, rfMap, ['Ticket_id', 'Ticket id', 'Ticket']);
    if (!tid) continue;
    reinforcement.push({
      ticketId: tid,
      ts: cellS(row, rfMap, 'Timestamp'),
      region: cellS(row, rfMap, 'Vùng'),
      warehouse: cellS(row, rfMap, ['warehouse', 'Bưu cục', 'Kho']),
      route: cellS(row, rfMap, 'Lộ trình'),
      employeeId: cellS(row, rfMap, 'MSNV'),
      phone: cellS(row, rfMap, ['Số điện thoại', 'SĐT']),
      packages: cellS(row, rfMap, 'Số lượng kiện'),
      volumeNeeded: cellS(row, rfMap, 'Thể tích cần'),
      requestDate: cellS(row, rfMap, 'Ngày mong muốn'),
      note: cellS(row, rfMap, 'Ghi chú'),
      status: cellS(row, rfMap, 'Trạng thái'),
      date: cellS(row, rfMap, 'Ngày'),
      arrivalTime: cellS(row, rfMap, 'Giờ tới'),
      tripCode: cellS(row, rfMap, 'Mã chuyến đi'),
      supplier: cellS(row, rfMap, ['Tên NCC', 'NCC']),
      plate: cellS(row, rfMap, 'BKS'),
      tonnage: cellS(row, rfMap, 'Tải trọng'),
      driverInfo: cellS(row, rfMap, ['Thông tin tx', 'Thông tin TX']),
    });
  }

  // 7. ONTIME (Ontime xe tải) - lấy bảng "Ontime theo Tuần"
  // Cấu trúc MỚI: mỗi dòng = 1 chuyến, có Time / Mã chuyến / Lịch tải / Lộ trình /
  // Tải trọng / Tài xế / BKS / Đối tác / SL Ontime Checkin / SL Điểm dừng.
  // ontime.trips = danh sách chuyến; giữ ontime.weekly/groups/weeks = [] cho tương thích cũ.
  const ontime = { groups: [], weeks: [], weekly: {}, trips: [] };
  const oSheet = workbook.Sheets['Ontime xe tải'];
  if (oSheet) {
    const oRows = XLSX.utils.sheet_to_json(oSheet, { header: 1, raw: true, defval: null });
    const oMap = buildColMap(oRows);
    const hasTrip = ('time' in oMap) || ('mã chuyến' in oMap);
    if (hasTrip) {
      for (let i = 1; i < oRows.length; i++) {
        const row = oRows[i] || [];
        const trip = cellS(row, oMap, ['Mã chuyến', 'Ma chuyen']);
        if (!trip) continue;
        const dRaw = cellS(row, oMap, ['Time', 'Ngày', 'Thời gian']);
        const onN = Number(cellRaw(row, oMap, ['SL Ontime Checkin', 'SL Ontime'])) || 0;
        const stN = Number(cellRaw(row, oMap, ['SL Điểm dừng', 'SL Diem dung'])) || 0;
        ontime.trips.push({
          dateStr: dRaw,                                   // "2026-07-27 - Thứ 2"
          date: (String(dRaw || '').match(/\d{4}-\d{2}-\d{2}/) || [null])[0],
          trip: trip,
          schedule: cellS(row, oMap, ['Lịch tải']),
          route: cellS(row, oMap, ['Lộ trình']),
          tonnage: cellS(row, oMap, ['Tải trọng']),
          driver: cellS(row, oMap, ['Tài xế']),
          plate: cellS(row, oMap, ['BKS']),
          partner: cellS(row, oMap, ['Đối tác', 'NCC']),
          onCheckin: onN,
          stops: stN,
          rate: stN ? onN / stN : null,
        });
      }
    }
  }

  // 8. BTBD (Bảo trì - Sửa chữa)
  const btbd = [];
  const bSheet = workbook.Sheets['BTBD'];
  if (bSheet) {
    const bRows = XLSX.utils.sheet_to_json(bSheet, { header: 1, raw: true, defval: null });
    const bMap = buildColMap(bRows);
    for (let i = 1; i < bRows.length; i++) {
      const row = bRows[i] || [];
      const plate = cellS(row, bMap, 'BKS');
      if (!plate) continue;
      btbd.push({
        plate: plate,
        vehicleInfo: cellS(row, bMap, ['Tải trọng/Hãng', 'Tải trọng']),
        yearUse: cellS(row, bMap, 'Năm sử dụng'),
        odo: cellS(row, bMap, 'ODO'),
        kmNextBD: cellS(row, bMap, ['KM định mức BD kì tới', 'KM định mức BD kỳ tới']),
        inDate: cellS(row, bMap, 'Ngày vào xưởng'),
        content: cellS(row, bMap, 'Nội dung'),
        category: cellS(row, bMap, ['Hạng mục BTBD', 'Hạng mục']),
        detail: cellS(row, bMap, ['Chi tiết Bảo dưỡng, Sửa chữa', 'Chi tiết']),
        garage: cellS(row, bMap, 'Gara'),
        expectedDate: cellS(row, bMap, ['Ngày dự kiến xong', 'Ngày dự kiến']),
        outDate: cellS(row, bMap, 'Ngày ra xưởng'),
        totalHours: cellS(row, bMap, 'Tổng giờ'),
        note: cellS(row, bMap, 'Ghi chú'),
        cost: cellS(row, bMap, 'Chi phí'),
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
  window._costChartsRendered = false;
  window._trendChartsRendered = false;

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
  captureHistorySnapshot();
  renderAssessment();
  renderCost();
  renderTrends();

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
  captureHistorySnapshot();
  renderAssessment();
  renderCost();
  renderTrends();

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
