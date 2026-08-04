/* ============================================================================
 * Khai báo khối "Phân tích theo kỳ" cho TỪNG TRANG của dashboard.
 * Mỗi trang: chọn trục thời gian phù hợp + các chỉ số cần so sánh.
 * Trang là ảnh chụp thời điểm (Hiệu suất, Lịch tải) -> so sánh theo NHÓM.
 * ==========================================================================*/
(function () {
  'use strict';

  // DATA được khai báo bằng const trong data.js -> KHÔNG nằm trên window.
  // Phải tham chiếu trực tiếp qua lexical scope.
  function D() { try { return (typeof DATA !== 'undefined' && DATA) ? DATA : {}; } catch (e) { return {}; } }
  function A(k) { return function () { var d = D(); return Array.isArray(d[k]) ? d[k] : []; }; }
  function money(v) { return (typeof parseCost === 'function') ? parseCost(v) : (parseFloat(String(v).replace(/[^0-9]/g, '')) || 0); }
  function noAcc(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]','g'), '').replace(/đ/g, 'd');
  }
  function finePaid(x) {
    var p = noAcc(x.progress);
    return (p.indexOf('da dong') !== -1 || p.indexOf('eform') !== -1);
  }

  function mountAll() {
    if (typeof mountPeriodBlock !== 'function') return;

    // ---------------- 1. PHẠT NGUỘI ----------------
    mountPeriodBlock({
      id: 'pb_fines', pageId: 'page-fines', title: 'Phạt nguội theo kỳ', defaultPeriod: 'month',
      higherIsBetter: false,
      rows: A('fines'), getDate: function (x) { return x.violationTime || x.reportDate; },
      metrics: [
        { key: 'n', label: 'Số vụ', type: 'num', calc: function (r) { return r.length; }, color: '#dc2626' },
        { key: 'cost', label: 'Chi phí (tr)', type: 'money', calc: function (r) { return r.reduce(function (s, x) { return s + money(x.cost); }, 0); }, color: '#8b5cf6' },
        { key: 'paid', label: 'Đã đóng', type: 'num', calc: function (r) { return r.filter(finePaid).length; }, color: '#16a34a' },
        { key: 'unpaid', label: 'Chưa đóng', type: 'num', calc: function (r) { return r.filter(function (x) { return !finePaid(x); }).length; }, color: '#d97706' }
      ]
    });

    // ---------------- 2. BTBD ----------------
    mountPeriodBlock({
      id: 'pb_btbd', pageId: 'page-btbd', title: 'BTBD theo kỳ (lượt vào xưởng & chi phí)', defaultPeriod: 'month',
      higherIsBetter: false,
      rows: A('btbd'), getDate: function (x) { return x.inDate; },
      metrics: [
        { key: 'n', label: 'Số lượt', type: 'num', calc: function (r) { return r.length; }, color: '#8b5cf6' },
        { key: 'cost', label: 'Chi phí (tr)', type: 'money', calc: function (r) { return r.reduce(function (s, x) { return s + money(x.cost); }, 0); }, color: '#17a398' },
        { key: 'xe', label: 'Số xe', type: 'num', calc: function (r) { var s = {}; r.forEach(function (x) { if (x.plate) s[x.plate] = 1; }); return Object.keys(s).length; }, color: '#0891b2' }
      ]
    });

    // ---------------- 3. TĂNG CƯỜNG LẤY ----------------
    mountPeriodBlock({
      id: 'pb_reinf', pageId: 'page-reinforcement', title: 'Tăng cường theo kỳ (nhu cầu & đáp ứng)', defaultPeriod: 'month',
      deltaMetric: 'rate', target: 90,
      rows: A('reinforcement'),
      getDate: function (x) { return (typeof reinfDateOf === 'function') ? reinfDateOf(x) : (x.ts || x.requestDate); },
      metrics: [
        { key: 'rate', label: '% Đáp ứng', type: 'pct', calc: function (r) {
            var ok = r.filter(function (x) { return noAcc(x.status).indexOf('co xe') === 0; }).length;
            var no = r.filter(function (x) { return noAcc(x.status).indexOf('khong co xe') === 0; }).length;
            return (ok + no) ? ok / (ok + no) : null; } },
        { key: 'n', label: 'Yêu cầu', type: 'num', calc: function (r) { return r.length; }, color: '#0891b2' },
        { key: 'ok', label: 'Có xe', type: 'num', calc: function (r) { return r.filter(function (x) { return noAcc(x.status).indexOf('co xe') === 0; }).length; }, color: '#16a34a' },
        { key: 'no', label: 'Không có xe', type: 'num', calc: function (r) { return r.filter(function (x) { return noAcc(x.status).indexOf('khong co xe') === 0; }).length; }, color: '#dc2626' },
        { key: 'cancel', label: 'Hủy', type: 'num', calc: function (r) { return r.filter(function (x) { return noAcc(x.status).indexOf('huy') === 0; }).length; }, color: '#d97706' }
      ]
    });

    // ---------------- 4. CHI PHÍ (BTBD + Phạt) ----------------
    mountPeriodBlock({
      id: 'pb_cost', pageId: 'page-cost', title: 'Chi phí vận hành theo kỳ (tách BTBD / Phạt nguội)', defaultPeriod: 'month',
      higherIsBetter: false, stacked: true,
      rows: function () {
        var out = [];
        ((D().btbd) || []).forEach(function (x) { out.push({ _t: 'btbd', d: x.inDate, c: money(x.cost) }); });
        ((D().fines) || []).forEach(function (x) { out.push({ _t: 'fine', d: x.violationTime || x.reportDate, c: money(x.cost) }); });
        return out;
      },
      getDate: function (x) { return x.d; },
      metrics: [
        { key: 'total', label: 'Tổng (tr)', type: 'money', calc: function (r) { return r.reduce(function (s, x) { return s + x.c; }, 0); }, chart: false },
        { key: 'btbd', label: 'BTBD (tr)', type: 'money', calc: function (r) { return r.filter(function (x) { return x._t === 'btbd'; }).reduce(function (s, x) { return s + x.c; }, 0); }, color: '#8b5cf6' },
        { key: 'fine', label: 'Phạt nguội (tr)', type: 'money', calc: function (r) { return r.filter(function (x) { return x._t === 'fine'; }).reduce(function (s, x) { return s + x.c; }, 0); }, color: '#dc2626' }
      ]
    });

    // ---------------- 5. NHÂN SỰ (tuyển mới / nghỉ việc) ----------------
    mountPeriodBlock({
      id: 'pb_staff', pageId: 'page-staff', title: 'Biến động nhân sự theo kỳ (vào làm / nghỉ việc)', defaultPeriod: 'month',
      note: 'Trục thời gian lấy từ "Ngày vào làm" (tuyển mới) và "Ngày nghỉ việc" (rời đi).',
      rows: function () {
        var out = [];
        ((D().drivers) || []).forEach(function (x) {
          if (x.startDate) out.push({ _t: 'in', d: x.startDate });
          if (x.endDate) out.push({ _t: 'out', d: x.endDate });
        });
        return out;
      },
      getDate: function (x) { return x.d; },
      metrics: [
        { key: 'in', label: 'Vào làm', type: 'num', calc: function (r) { return r.filter(function (x) { return x._t === 'in'; }).length; }, color: '#16a34a' },
        { key: 'out', label: 'Nghỉ việc', type: 'num', calc: function (r) { return r.filter(function (x) { return x._t === 'out'; }).length; }, color: '#dc2626' },
        { key: 'net', label: 'Tăng/giảm ròng', type: 'num', calc: function (r) { return r.filter(function (x) { return x._t === 'in'; }).length - r.filter(function (x) { return x._t === 'out'; }).length; }, color: '#0891b2' }
      ]
    });

    // ---------------- 6. THÔNG TIN XE (giấy tờ đến hạn) ----------------
    mountPeriodBlock({
      id: 'pb_veh', pageId: 'page-vehicles', title: 'Giấy tờ xe đến hạn theo kỳ', defaultPeriod: 'month',
      higherIsBetter: false,
      note: 'Đếm số mục giấy tờ (đăng kiểm, phù hiệu, phí đường bộ, BH dân sự) đáo hạn trong kỳ — dùng để lên kế hoạch gia hạn.',
      rows: function () {
        var out = [];
        ((D().vehicles) || []).forEach(function (x) {
          if (x.inspectionExpiry) out.push({ _t: 'dk', d: x.inspectionExpiry, p: x.plate });
          if (x.badgeExpiry) out.push({ _t: 'ph', d: x.badgeExpiry, p: x.plate });
          if (x.roadFeeExpiry) out.push({ _t: 'db', d: x.roadFeeExpiry, p: x.plate });
          if (x.liabilityExpiry) out.push({ _t: 'bh', d: x.liabilityExpiry, p: x.plate });
        });
        return out;
      },
      getDate: function (x) { return x.d; },
      metrics: [
        { key: 'all', label: 'Tổng mục đến hạn', type: 'num', calc: function (r) { return r.length; }, color: '#d97706' },
        { key: 'dk', label: 'Đăng kiểm', type: 'num', calc: function (r) { return r.filter(function (x) { return x._t === 'dk'; }).length; }, color: '#dc2626' },
        { key: 'ph', label: 'Phù hiệu', type: 'num', calc: function (r) { return r.filter(function (x) { return x._t === 'ph'; }).length; }, color: '#8b5cf6' },
        { key: 'db', label: 'Phí đường bộ', type: 'num', calc: function (r) { return r.filter(function (x) { return x._t === 'db'; }).length; }, color: '#0891b2' },
        { key: 'bh', label: 'BH dân sự', type: 'num', calc: function (r) { return r.filter(function (x) { return x._t === 'bh'; }).length; }, color: '#16a34a' }
      ]
    });

    // ---------------- 7. ONTIME (theo chuyến) ----------------
    mountPeriodBlock({
      id: 'pb_ontime', pageId: 'page-ontime', title: 'Ontime theo kỳ (tất cả mốc thời gian)', defaultPeriod: 'week',
      deltaMetric: 'rate', target: 95,
      rows: function () { return (D().ontime && D().ontime.trips) || []; },
      getDate: function (x) { return x.date; },
      metrics: [
        { key: 'rate', label: '% Ontime', type: 'pct', calc: function (r) {
            var on = r.reduce(function (s, x) { return s + (x.onCheckin || 0); }, 0);
            var st = r.reduce(function (s, x) { return s + (x.stops || 0); }, 0);
            return st ? on / st : null; } },
        { key: 'trips', label: 'Số chuyến', type: 'num', calc: function (r) { return r.length; }, color: '#0891b2' },
        { key: 'on', label: 'Đúng giờ', type: 'num', calc: function (r) { return r.reduce(function (s, x) { return s + (x.onCheckin || 0); }, 0); }, color: '#16a34a' },
        { key: 'late', label: 'Trễ', type: 'num', calc: function (r) { return r.reduce(function (s, x) { return s + ((x.stops || 0) - (x.onCheckin || 0)); }, 0); }, color: '#dc2626' }
      ]
    });

    // ---------------- 8. DASHBOARD (tổng hợp đa chỉ số) ----------------
    mountPeriodBlock({
      id: 'pb_dash', pageId: 'page-dashboard', title: 'Tổng quan vận hành theo kỳ', defaultPeriod: 'month',
      note: 'Gộp các nghiệp vụ có mốc thời gian: ticket tăng cường, lượt BTBD, vụ phạt nguội và chuyến chạy.',
      rows: function () {
        var out = [];
        ((D().reinforcement) || []).forEach(function (x) {
          var d = (typeof reinfDateOf === 'function') ? reinfDateOf(x) : (x.ts || x.requestDate);
          if (d) out.push({ _t: 'tc', d: d });
        });
        ((D().btbd) || []).forEach(function (x) { if (x.inDate) out.push({ _t: 'bt', d: x.inDate, c: money(x.cost) }); });
        ((D().fines) || []).forEach(function (x) { var d = x.violationTime || x.reportDate; if (d) out.push({ _t: 'ph', d: d, c: money(x.cost) }); });
        ((D().ontime && D().ontime.trips) || []).forEach(function (x) { if (x.date) out.push({ _t: 'ot', d: x.date }); });
        return out;
      },
      getDate: function (x) { return x.d; },
      metrics: [
        { key: 'tc', label: 'Ticket tăng cường', type: 'num', calc: function (r) { return r.filter(function (x) { return x._t === 'tc'; }).length; }, color: '#0891b2' },
        { key: 'ot', label: 'Chuyến chạy', type: 'num', calc: function (r) { return r.filter(function (x) { return x._t === 'ot'; }).length; }, color: '#17a398' },
        { key: 'bt', label: 'Lượt BTBD', type: 'num', calc: function (r) { return r.filter(function (x) { return x._t === 'bt'; }).length; }, color: '#8b5cf6' },
        { key: 'ph', label: 'Vụ phạt', type: 'num', calc: function (r) { return r.filter(function (x) { return x._t === 'ph'; }).length; }, color: '#dc2626' }
      ]
    });

    // ---------------- 9. XU HƯỚNG (chi phí + khối lượng) ----------------
    mountPeriodBlock({
      id: 'pb_trend', pageId: 'page-trends', title: 'Xu hướng chi phí & khối lượng theo kỳ', defaultPeriod: 'month',
      higherIsBetter: false, stacked: true,
      rows: function () {
        var out = [];
        ((D().btbd) || []).forEach(function (x) { if (x.inDate) out.push({ _t: 'bt', d: x.inDate, c: money(x.cost) }); });
        ((D().fines) || []).forEach(function (x) { var d = x.violationTime || x.reportDate; if (d) out.push({ _t: 'ph', d: d, c: money(x.cost) }); });
        return out;
      },
      getDate: function (x) { return x.d; },
      metrics: [
        { key: 'cost', label: 'Tổng chi phí (tr)', type: 'money', calc: function (r) { return r.reduce(function (s, x) { return s + (x.c || 0); }, 0); }, chart: false },
        { key: 'bt', label: 'BTBD (tr)', type: 'money', calc: function (r) { return r.filter(function (x) { return x._t === 'bt'; }).reduce(function (s, x) { return s + x.c; }, 0); }, color: '#8b5cf6' },
        { key: 'ph', label: 'Phạt (tr)', type: 'money', calc: function (r) { return r.filter(function (x) { return x._t === 'ph'; }).reduce(function (s, x) { return s + x.c; }, 0); }, color: '#dc2626' }
      ]
    });

    // ---------------- 10. ĐÁNH GIÁ & CẢI THIỆN ----------------
    mountPeriodBlock({
      id: 'pb_assess', pageId: 'page-assessment', title: 'Diễn biến các chỉ tiêu theo kỳ', defaultPeriod: 'month',
      note: 'Đối chiếu chỉ tiêu chính giữa các kỳ: % đáp ứng tăng cường, % ontime, số vụ phạt, lượt BTBD.',
      rows: function () {
        var out = [];
        ((D().reinforcement) || []).forEach(function (x) {
          var d = (typeof reinfDateOf === 'function') ? reinfDateOf(x) : (x.ts || x.requestDate);
          if (d) out.push({ _t: 'tc', d: d, st: noAcc(x.status) });
        });
        ((D().ontime && D().ontime.trips) || []).forEach(function (x) { if (x.date) out.push({ _t: 'ot', d: x.date, on: x.onCheckin || 0, sp: x.stops || 0 }); });
        ((D().fines) || []).forEach(function (x) { var d = x.violationTime || x.reportDate; if (d) out.push({ _t: 'ph', d: d }); });
        ((D().btbd) || []).forEach(function (x) { if (x.inDate) out.push({ _t: 'bt', d: x.inDate }); });
        return out;
      },
      getDate: function (x) { return x.d; },
      deltaMetric: 'ontime', target: 95,
      metrics: [
        { key: 'ontime', label: '% Ontime', type: 'pct', calc: function (r) {
            var t = r.filter(function (x) { return x._t === 'ot'; });
            var on = t.reduce(function (s, x) { return s + x.on; }, 0), sp = t.reduce(function (s, x) { return s + x.sp; }, 0);
            return sp ? on / sp : null; } },
        { key: 'dapung', label: '% Đáp ứng TC', type: 'pct', calc: function (r) {
            var t = r.filter(function (x) { return x._t === 'tc'; });
            var ok = t.filter(function (x) { return x.st.indexOf('co xe') === 0; }).length;
            var no = t.filter(function (x) { return x.st.indexOf('khong co xe') === 0; }).length;
            return (ok + no) ? ok / (ok + no) : null; } },
        { key: 'ph', label: 'Vụ phạt', type: 'num', calc: function (r) { return r.filter(function (x) { return x._t === 'ph'; }).length; }, color: '#dc2626' },
        { key: 'bt', label: 'Lượt BTBD', type: 'num', calc: function (r) { return r.filter(function (x) { return x._t === 'bt'; }).length; }, color: '#8b5cf6' }
      ]
    });

    // ---------------- 11 & 12. HIỆU SUẤT XE và LỊCH TẢI (ảnh chụp thời điểm) ----------------
    // Hai sheet này KHÔNG có cột ngày phát sinh (là dữ liệu hiện trạng), nên không thể
    // chia theo Ngày/Tuần/Tháng/Năm. Thay bằng so sánh theo NHÓM để vẫn có đối chiếu.
    mountGroupBlock({
      id: 'gb_eff', pageId: 'page-efficiency',
      title: 'So sánh hiệu suất theo nhóm',
      note: 'Sheet "Hiệu suất sử dụng xe" là số liệu hiện trạng của kỳ đo (không có cột ngày), nên so sánh theo nhóm thay vì theo thời gian. Ontime/BTBD có mốc thời gian đầy đủ.',
      groups: [
        { label: 'Theo loại xe', get: function (x) { return x.vehicleType || 'Khác'; } },
        { label: 'Theo kho quản lý', get: function (x) { return x.depot || 'Khác'; } },
        { label: 'Theo tình trạng VH', get: function (x) { return x.opStatus || 'Khác'; } }
      ],
      rows: A('efficiency'),
      valueLabel: 'Hiệu suất TB (%)',
      value: function (r) { var v = r.map(function (x) { return x.efficiency; }).filter(function (x) { return typeof x === 'number'; }); return v.length ? v.reduce(function (s, x) { return s + x; }, 0) / v.length : 0; },
      extraLabel: 'Tổng KM',
      extra: function (r) { return r.reduce(function (s, x) { return s + (typeof x.totalKm === 'number' ? x.totalKm : 0); }, 0); }
    });

    mountGroupBlock({
      id: 'gb_sched', pageId: 'page-schedule',
      title: 'So sánh lịch tải theo nhóm',
      note: 'Sheet "Lịch tải" là lịch cố định (không có cột ngày phát sinh) nên so sánh theo nhóm. Muốn xem theo thời gian, dùng trang Ontime (dữ liệu chuyến chạy thực tế).',
      groups: [
        { label: 'Theo loại hình', get: function (x) { return x.type || 'Khác'; } },
        { label: 'Theo NCC', get: function (x) { return x.supplier || '(Chưa gán)'; } },
        { label: 'Theo tải trọng', get: function (x) { return x.tonnage || 'Khác'; } }
      ],
      rows: A('routes'),
      valueLabel: 'Số tuyến',
      value: function (r) { return r.length; },
      extraLabel: 'Tổng Km',
      extra: function (r) { return r.reduce(function (s, x) { return s + (parseFloat(String(x.km || '').replace(/,/g, '')) || 0); }, 0); }
    });
  }

  // ---- Khối so sánh theo NHÓM (cho dữ liệu không có trục thời gian) ----
  var gState = {}, gCharts = {};
  function mountGroupBlock(cfg) {
    var page = document.getElementById(cfg.pageId);
    if (!page) return;
    var wrap = document.getElementById(cfg.id);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = cfg.id;
      wrap.innerHTML =
        '<div class="table-card" style="padding:14px 18px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
            '<div style="font-size:14px;font-weight:700;color:var(--text-primary)">📊 ' + cfg.title + '</div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap" data-role="gbtns"></div>' +
          '</div>' +
          '<div style="font-size:11px;color:var(--text-muted);margin-top:6px">ℹ️ ' + cfg.note + '</div>' +
        '</div>' +
        '<div class="chart-grid"><div class="chart-card" style="grid-column:1/-1">' +
          '<div class="chart-title"><span class="dot" style="background:var(--purple)"></span> Biểu đồ so sánh</div>' +
          '<canvas id="' + cfg.id + '_c"></canvas></div></div>';
      var kpi = page.querySelector('.kpi-grid');
      if (kpi && kpi.nextSibling) page.insertBefore(wrap, kpi.nextSibling); else page.appendChild(wrap);
      var btns = wrap.querySelector('[data-role=gbtns]');
      cfg.groups.forEach(function (g, i) {
        var b = document.createElement('button');
        b.textContent = g.label; b.dataset.gi = i;
        b.addEventListener('click', function () { gState[cfg.id] = i; renderGroup(cfg); });
        btns.appendChild(b);
      });
    }
    renderGroup(cfg);
  }

  function renderGroup(cfg) {
    var wrap = document.getElementById(cfg.id);
    if (!wrap) return;
    var gi = gState[cfg.id] || 0;
    wrap.querySelectorAll('[data-role=gbtns] button').forEach(function (b) {
      var on = +b.dataset.gi === gi;
      b.style.cssText = 'padding:6px 12px;font-size:12px;border-radius:6px;border:1px solid var(--border-color);cursor:pointer;font-weight:' +
        (on ? '700;background:var(--accent);color:#fff' : '400;background:var(--bg-card);color:var(--text-secondary)');
    });
    var rows = cfg.rows() || [];
    var g = cfg.groups[gi];
    var buckets = {};
    rows.forEach(function (x) { var k = g.get(x); (buckets[k] = buckets[k] || []).push(x); });
    var keys = Object.keys(buckets).sort(function (a, b) { return buckets[b].length - buckets[a].length; }).slice(0, 12);
    var el = document.getElementById(cfg.id + '_c');
    if (!el) return;
    if (gCharts[cfg.id]) { try { gCharts[cfg.id].destroy(); } catch (e) {} }
    gCharts[cfg.id] = new Chart(el, {
      data: {
        labels: keys,
        datasets: [
          { type: 'bar', label: cfg.valueLabel, data: keys.map(function (k) { return Math.round(cfg.value(buckets[k]) * 10) / 10; }), backgroundColor: '#17a398', borderWidth: 0, borderRadius: 4, yAxisID: 'y' },
          { type: 'line', label: cfg.extraLabel, data: keys.map(function (k) { return Math.round(cfg.extra(buckets[k])); }), borderColor: '#8b5cf6', backgroundColor: '#8b5cf6', borderWidth: 3, tension: .3, pointRadius: 3, yAxisID: 'y1' }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12 } } },
        scales: { y: { position: 'left', title: { display: true, text: cfg.valueLabel } },
                  y1: { position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: cfg.extraLabel } } }
      }
    });
  }

  window.mountAllPeriodBlocks = mountAll;
})();
