/* ============================================================================
 * GHN Ops Dashboard — MODULE PHÂN TÍCH THEO KỲ (dùng chung cho mọi trang)
 * ----------------------------------------------------------------------------
 * Cung cấp: Ngày / Tuần / Tháng / Quý / Năm + bảng chi tiết (có Δ so kỳ trước)
 * + 2 biểu đồ so sánh (xu hướng và cột so sánh giữa các kỳ).
 *
 * Cách dùng: mountPeriodBlock({ id, pageId, title, rows, getDate, metrics, ... })
 * Khối UI được chèn động nên không cần sửa nhiều trong index.html.
 * ==========================================================================*/
(function () {
  'use strict';

  var PERIODS = [
    { k: 'day', t: 'Theo ngày' },
    { k: 'week', t: 'Theo tuần' },
    { k: 'month', t: 'Theo tháng' },
    { k: 'quarter', t: 'Theo quý' },
    { k: 'year', t: 'Theo năm' }
  ];
  var state = {};   // id -> period đang chọn
  var charts = {};  // id -> [Chart]

  // ------------------------------------------------------------- tiện ích
  function pad(n) { return ('0' + n).slice(-2); }
  function toDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (typeof v === 'number' && v > 20000 && v < 90000) { // serial Excel
      var dt = new Date(Math.round((v - 25569) * 86400000));
      return isNaN(dt) ? null : new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
    }
    var s = String(v).trim();
    var m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    m = s.match(/^(\d{1,2})\/(\d{1,2})$/); if (m) return new Date(new Date().getFullYear(), +m[2] - 1, +m[1]);
    var d = new Date(s); return isNaN(d) ? null : d;
  }
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { year: t.getUTCFullYear(), week: Math.ceil(((t - y0) / 86400000 + 1) / 7) };
  }
  function keyOf(d, period) {
    if (period === 'day') {
      return { key: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
               label: pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(),
               sort: d.getTime() };
    }
    if (period === 'week') {
      var iw = isoWeek(d);
      var mon = new Date(d); mon.setDate(d.getDate() - (d.getDay() || 7) + 1);
      var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { key: iw.year + '-W' + pad(iw.week),
               label: 'W' + pad(iw.week) + ' (' + pad(mon.getDate()) + '/' + pad(mon.getMonth() + 1) + '–' + pad(sun.getDate()) + '/' + pad(sun.getMonth() + 1) + ')',
               sort: mon.getTime() };
    }
    if (period === 'month') {
      return { key: d.getFullYear() + '-' + pad(d.getMonth() + 1),
               label: pad(d.getMonth() + 1) + '/' + d.getFullYear(),
               sort: new Date(d.getFullYear(), d.getMonth(), 1).getTime() };
    }
    if (period === 'quarter') {
      var q = Math.floor(d.getMonth() / 3) + 1;
      return { key: d.getFullYear() + '-Q' + q, label: 'Q' + q + '/' + d.getFullYear(),
               sort: new Date(d.getFullYear(), (q - 1) * 3, 1).getTime() };
    }
    return { key: String(d.getFullYear()), label: 'Năm ' + d.getFullYear(),
             sort: new Date(d.getFullYear(), 0, 1).getTime() };
  }
  function nf(n) {
    if (n == null || isNaN(n)) return '—';
    try { return new Intl.NumberFormat('vi-VN').format(Math.round(n)); } catch (e) { return String(n); }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtVal(v, type) {
    if (v == null || (typeof v === 'number' && isNaN(v))) return '—';
    if (type === 'pct') return (v * 100).toFixed(1) + '%';
    if (type === 'money') return nf(v) + 'đ';
    if (type === 'mil') return (v / 1000000).toFixed(1) + 'tr';
    return nf(v);
  }

  // -------------------------------------------------- gộp dữ liệu theo kỳ
  // metrics: [{key,label,type:'num|money|pct|mil', calc(bucketRows), chart:true|false, color}]
  function buildSeries(cfg, period) {
    var buckets = {};
    // Với dữ liệu LỊCH SỬ (đã xảy ra), bỏ các mốc ở tương lai — thường do ô ngày
    // trên Google Sheet bị hiểu sai định dạng (mm/dd) hoặc nhập thiếu.
    var today = new Date(); today.setHours(23, 59, 59, 999);
    (cfg.rows() || []).forEach(function (r) {
      var d = toDate(cfg.getDate(r));
      if (!d) return;
      if (cfg.dropFuture && d > today) return;
      var k = keyOf(d, period);
      var b = buckets[k.key] || (buckets[k.key] = { key: k.key, label: k.label, sort: k.sort, rows: [] });
      b.rows.push(r);
    });
    var list = Object.keys(buckets).map(function (k) { return buckets[k]; })
      .sort(function (a, b) { return a.sort - b.sort; });
    list.forEach(function (b) {
      b.vals = {};
      cfg.metrics.forEach(function (m) { b.vals[m.key] = m.calc(b.rows); });
    });
    return list;
  }

  // ----------------------------------------------------------- dựng UI
  function ensureBlock(cfg) {
    var page = document.getElementById(cfg.pageId);
    if (!page) return null;
    var wrap = document.getElementById(cfg.id);
    if (wrap) return wrap;
    wrap = document.createElement('div');
    wrap.id = cfg.id;
    wrap.innerHTML =
      '<div class="table-card" style="padding:14px 18px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
          '<div style="font-size:14px;font-weight:700;color:var(--text-primary)">📅 ' + esc(cfg.title) + '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap" data-role="btns"></div>' +
        '</div>' +
        (cfg.note ? '<div style="font-size:11px;color:var(--text-muted);margin-top:6px">' + cfg.note + '</div>' : '') +
      '</div>' +
      '<div class="chart-grid">' +
        '<div class="chart-card"><div class="chart-title"><span class="dot" style="background:var(--accent)"></span> Xu hướng theo kỳ</div><canvas id="' + cfg.id + '_trend"></canvas></div>' +
        '<div class="chart-card"><div class="chart-title"><span class="dot" style="background:var(--purple)"></span> So sánh giữa các kỳ</div><canvas id="' + cfg.id + '_cmp"></canvas></div>' +
      '</div>' +
      '<div class="table-card">' +
        '<div class="table-header"><h3>📊 Chi tiết theo kỳ <span data-role="range" style="font-weight:400;color:var(--text-muted);font-size:12px"></span></h3></div>' +
        '<div style="overflow-x:auto;max-height:400px;overflow-y:auto"><table><thead data-role="thead"></thead><tbody data-role="tbody"></tbody></table></div>' +
      '</div>';
    // chèn ngay sau khối KPI đầu tiên của trang (nếu có)
    var kpi = page.querySelector('.kpi-grid');
    if (kpi && kpi.nextSibling) page.insertBefore(wrap, kpi.nextSibling);
    else if (kpi) page.appendChild(wrap);
    else page.insertBefore(wrap, page.firstChild);

    var btns = wrap.querySelector('[data-role=btns]');
    PERIODS.forEach(function (p) {
      var b = document.createElement('button');
      b.textContent = p.t; b.dataset.period = p.k;
      b.addEventListener('click', function () { state[cfg.id] = p.k; render(cfg); });
      btns.appendChild(b);
    });
    return wrap;
  }

  function destroyCharts(id) {
    (charts[id] || []).forEach(function (c) { try { c.destroy(); } catch (e) {} });
    charts[id] = [];
  }

  function render(cfg) {
    var wrap = ensureBlock(cfg);
    if (!wrap) return;
    var period = state[cfg.id] || cfg.defaultPeriod || 'month';
    state[cfg.id] = period;

    // trạng thái nút
    wrap.querySelectorAll('[data-role=btns] button').forEach(function (b) {
      var on = b.dataset.period === period;
      b.style.cssText = 'padding:6px 12px;font-size:12px;border-radius:6px;border:1px solid var(--border-color);cursor:pointer;font-weight:' +
        (on ? '700;background:var(--accent);color:#fff' : '400;background:var(--bg-card);color:var(--text-secondary)');
    });

    var list = buildSeries(cfg, period);
    var thead = wrap.querySelector('[data-role=thead]');
    var tbody = wrap.querySelector('[data-role=tbody]');
    var range = wrap.querySelector('[data-role=range]');

    if (!list.length) {
      thead.innerHTML = '';
      tbody.innerHTML = '<tr><td style="text-align:center;color:var(--text-muted);padding:16px">Chưa có dữ liệu — bấm "🔄 Đồng bộ trực tuyến"</td></tr>';
      destroyCharts(cfg.id);
      return;
    }
    if (range) range.textContent = '— ' + list.length + ' kỳ';

    // bảng
    var mainKey = cfg.deltaMetric || cfg.metrics[0].key;
    var mainType = (cfg.metrics.filter(function (m) { return m.key === mainKey; })[0] || cfg.metrics[0]).type;
    thead.innerHTML = '<tr><th>Kỳ</th>' + cfg.metrics.map(function (m) { return '<th>' + esc(m.label) + '</th>'; }).join('') + '<th>Δ so kỳ trước</th></tr>';
    var rev = list.slice().reverse();
    tbody.innerHTML = rev.map(function (b, i) {
      var p = rev[i + 1];
      var cur = b.vals[mainKey], prv = p ? p.vals[mainKey] : null;
      var dTxt = '—';
      if (typeof cur === 'number' && typeof prv === 'number') {
        var d = cur - prv;
        var good = cfg.higherIsBetter === false ? d < 0 : d > 0;
        var col = d === 0 ? 'var(--text-muted)' : (good ? 'var(--success)' : 'var(--danger)');
        var txt = mainType === 'pct' ? ((d >= 0 ? '+' : '') + (d * 100).toFixed(1) + ' đ%')
          : ((d >= 0 ? '+' : '−') + fmtVal(Math.abs(d), mainType));
        dTxt = '<span style="color:' + col + ';font-weight:700">' + txt + '</span>';
      }
      return '<tr><td style="font-weight:600;color:var(--text-primary)">' + esc(b.label) + '</td>' +
        cfg.metrics.map(function (m) { return '<td>' + fmtVal(b.vals[m.key], m.type) + '</td>'; }).join('') +
        '<td>' + dTxt + '</td></tr>';
    }).join('');

    // biểu đồ
    destroyCharts(cfg.id);
    var limit = period === 'day' ? 30 : period === 'week' ? 16 : period === 'month' ? 18 : 12;
    var show = list.slice(-limit);
    var labels = show.map(function (b) { return b.label; });
    var chartMetrics = cfg.metrics.filter(function (m) { return m.chart !== false; });
    var palette = ['#17a398', '#8b5cf6', '#dc2626', '#d97706', '#0891b2', '#16a34a'];

    // 1) xu hướng: chỉ số chính dạng đường
    var elT = document.getElementById(cfg.id + '_trend');
    if (elT) {
      var mainMetric = chartMetrics.filter(function (m) { return m.key === mainKey; })[0] || chartMetrics[0];
      var ds = [{
        label: mainMetric.label,
        data: show.map(function (b) { var v = b.vals[mainMetric.key]; return mainMetric.type === 'pct' ? (v == null ? null : Math.round(v * 1000) / 10) : (mainMetric.type === 'money' ? (v || 0) / 1000000 : v); }),
        borderColor: '#17a398', backgroundColor: 'rgba(23,163,152,.18)', tension: .3, fill: true, borderWidth: 3, pointRadius: 3
      }];
      if (cfg.target != null) ds.push({ label: 'Mục tiêu', data: show.map(function () { return cfg.target; }), borderColor: '#dc2626', borderDash: [6, 4], borderWidth: 2, pointRadius: 0, fill: false });
      charts[cfg.id].push(new Chart(elT, {
        type: 'line', data: { labels: labels, datasets: ds },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12 } } },
          scales: { y: { ticks: { callback: function (v) { return mainMetric.type === 'pct' ? v + '%' : (mainMetric.type === 'money' ? v + 'tr' : nf(v)); } } } } }
      }));
    }

    // 2) so sánh: các chỉ số đếm dạng cột (nhóm)
    var elC = document.getElementById(cfg.id + '_cmp');
    var cmpMetrics = chartMetrics.filter(function (m) { return m.type !== 'pct'; });
    if (elC && cmpMetrics.length) {
      charts[cfg.id].push(new Chart(elC, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: cmpMetrics.map(function (m, i) {
            return { label: m.label, data: show.map(function (b) { var v = b.vals[m.key]; return m.type === 'money' ? Math.round((v || 0) / 1000000 * 10) / 10 : v; }),
              backgroundColor: m.color || palette[i % palette.length], borderWidth: 0, borderRadius: 4,
              stack: cfg.stacked ? 'st' : undefined };
          })
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12 } } },
          scales: { x: { stacked: !!cfg.stacked }, y: { stacked: !!cfg.stacked, ticks: { callback: function (v) { return nf(v); } } } } }
      }));
    }
  }

  // Đăng ký + render (gọi lại an toàn nhiều lần)
  var registry = {};
  window.mountPeriodBlock = function (cfg) {
    registry[cfg.id] = cfg;
    try { render(cfg); } catch (e) { console.error('periodBlock ' + cfg.id, e); }
  };
  window.refreshPeriodBlocks = function () {
    Object.keys(registry).forEach(function (k) { try { render(registry[k]); } catch (e) {} });
  };
  window.periodUtils = { toDate: toDate, keyOf: keyOf, isoWeek: isoWeek, nf: nf };
})();
