/* ============================================================================
 * GHN Ops Dashboard — Trợ lý ảo Hỏi–Đáp (Virtual Assistant)
 * ----------------------------------------------------------------------------
 * - Bộ não KẾT HỢP:
 *     1) Máy truy vấn NỘI BỘ  : chạy trong trình duyệt, không cần API key,
 *        miễn phí, dữ liệu KHÔNG rời máy. Phủ ~80% câu hỏi tra cứu/thống kê.
 *     2) LLM TÙY CHỌN          : khi câu hỏi vượt khả năng nội bộ VÀ người dùng
 *        tự cấu hình API key (OpenAI-compatible hoặc Anthropic) trong Cài đặt.
 * - Giao diện: nút chat nổi góc phải, dùng được ở mọi trang.
 * - Đọc dữ liệu trực tiếp từ object toàn cục DATA (do data.js/app.js quản lý),
 *   nên luôn phản ánh dữ liệu mới nhất sau khi Đồng bộ Google Sheet / Import.
 * ==========================================================================*/
(function () {
  'use strict';

  // ------------------------------------------------------------------ CONFIG
  var LS_KEY = 'ghn_assistant_settings_v1';
  var DEFAULTS = {
    provider: 'local',              // 'local' | 'openai' | 'anthropic'
    apiKey: '',
    model: '',
    baseURL: '',                    // cho OpenAI-compatible tùy chọn
    maskPII: true,                  // ẩn tên/SĐT/MSNV khi gửi LLM
    preferLLM: false                // luôn ưu tiên LLM (nếu có key)
  };

  function loadSettings() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      return Object.assign({}, DEFAULTS, s);
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function saveSettings(s) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {}
  }
  var settings = loadSettings();

  // -------------------------------------------------------------- DATA ACCESS
  function getDATA() {
    try { if (typeof DATA !== 'undefined' && DATA) return DATA; } catch (e) {}
    if (window.DATA) return window.DATA;
    return {};
  }
  function arr(k) { var d = getDATA(); return Array.isArray(d[k]) ? d[k] : []; }

  // --------------------------------------------------------------- UTILITIES
  function noAccent(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .trim();
  }
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtNum(n) {
    try { return new Intl.NumberFormat('vi-VN').format(Math.round(n)); }
    catch (e) { return String(n); }
  }
  function parseMoney(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') { var c = v.replace(/[^0-9]/g, ''); return c ? parseInt(c, 10) : 0; }
    return 0;
  }
  function has(q, words) { // q đã noAccent; words: mảng từ khóa (noAccent)
    for (var i = 0; i < words.length; i++) if (q.indexOf(words[i]) !== -1) return true;
    return false;
  }
  function val(v) { return (v === null || v === undefined || v === '') ? '—' : v; }

  // Bảng gọn cho câu trả lời
  function table(headers, rows) {
    if (!rows.length) return '';
    var h = '<div class="ga-tblwrap"><table class="ga-tbl"><thead><tr>' +
      headers.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') +
      '</tr></thead><tbody>';
    var b = rows.map(function (r) {
      return '<tr>' + r.map(function (c) { return '<td>' + (c == null ? '—' : esc(c)) + '</td>'; }).join('') + '</tr>';
    }).join('');
    return h + b + '</tbody></table></div>';
  }
  function kv(pairs) {
    return '<div class="ga-kv">' + pairs.map(function (p) {
      return '<div class="ga-kv-row"><span class="ga-kv-k">' + esc(p[0]) + '</span><span class="ga-kv-v">' + esc(val(p[1])) + '</span></div>';
    }).join('') + '</div>';
  }
  function note(t) { return '<div class="ga-note">' + t + '</div>'; }

  // Tìm biển số trong câu (51C-123.45 / 29H1-234 / 51D 12345 ...)
  function plateIn(text) {
    var m = String(text).toUpperCase().match(/\d{2}\s*[A-Z]{1,2}\d?\s*[-\s]?\d{2,3}\.?\d{0,3}/);
    return m ? m[0].replace(/\s+/g, ' ').trim() : null;
  }
  function plateKey(p) { return noAccent(p).replace(/[^a-z0-9]/g, ''); }

  // ====================================================================== NLU
  // Trả về {answer:HTML, matched:bool}
  function runLocal(rawQ) {
    var q = noAccent(rawQ);
    if (!q) return { answer: '', matched: false };

    // 0) Trợ giúp / chào hỏi
    if (has(q, ['giup gi', 'lam duoc gi', 'ban la ai', 'huong dan', 'hoi gi', 'tro giup', 'help']) ||
        /^(hi|hello|xin chao|chao|alo)\b/.test(q)) {
      return { answer: helpText(), matched: true };
    }

    // 1) Hạn giấy tờ sắp hết / quá hạn
    if (has(q, ['het han', 'sap het', 'qua han', 'con han', 'sap toi han'])) {
      return { answer: answerExpiry(q), matched: true };
    }

    // Có nhắc "tuyến"/"lịch tải" → route (đặt trước vehicle để không bị nuốt)
    var wantRoute = has(q, ['tuyen', 'lich tai', 'lo trinh']);
    var wantFine = has(q, ['phat nguoi', 'phat', 'vi pham']);
    var wantBTBD = has(q, ['btbd', 'bao tri', 'sua chua', 'vao xuong', 'xuong', 'gara']);
    var wantStaff = has(q, ['nhan su', 'tai xe', 'lai xe', 'tai xê', 'nhan vien', 'msnv', 'mssv']);
    var wantReinf = has(q, ['tang cuong', 'ticket']);
    var wantOntime = has(q, ['ontime', 'dung gio', 'on time', 'tre gio']);
    var wantEff = has(q, ['hieu suat', 'su dung xe', 'van hanh']);
    var isCount = has(q, ['bao nhieu', 'so luong', 'tong so', 'tong cong', 'dem ', 'may xe', 'may tai', 'con lai', 'co bao nhieu']);

    // 2) Tra cứu xe theo biển số (ưu tiên khi có biển & không phải câu đếm/tuyến)
    var plate = plateIn(rawQ);
    if (plate && !isCount && !wantRoute && !wantFine && !wantBTBD && !wantReinf && !wantEff && !wantOntime) {
      var res = answerVehicleByPlate(plate);
      if (res) return { answer: res, matched: true };
    }

    // 3) Câu đếm / thống kê tổng
    if (isCount) {
      if (wantFine) return { answer: answerFineCount(q), matched: true };
      if (wantStaff) return { answer: answerStaffCount(q), matched: true };
      if (wantRoute) return { answer: answerRouteCount(q), matched: true };
      if (wantReinf) return { answer: answerReinfCount(q), matched: true };
      if (wantBTBD) return { answer: answerBTBDCount(q), matched: true };
      // mặc định: xe
      return { answer: answerVehicleCount(q), matched: true };
    }

    // 4) Theo chủ đề
    if (wantFine) return { answer: answerFines(q, rawQ), matched: true };
    if (wantBTBD) return { answer: answerBTBD(q, rawQ), matched: true };
    if (wantRoute) return { answer: answerRoutes(q, rawQ), matched: true };
    if (wantReinf) return { answer: answerReinf(q, rawQ), matched: true };
    if (wantOntime) return { answer: answerOntime(q), matched: true };
    if (wantEff) return { answer: answerEfficiency(q, rawQ), matched: true };
    if (wantStaff) return { answer: answerStaff(q, rawQ), matched: true };

    // 5) Nếu có biển số nhưng lọt các nhánh trên
    if (plate) {
      var r2 = answerVehicleByPlate(plate);
      if (r2) return { answer: r2, matched: true };
    }

    // 6) Tra cứu xe chung "thông tin xe ..."
    if (has(q, ['thong tin xe', 'xe tai', 'danh sach xe', 'con xe', 'bien so'])) {
      return { answer: answerVehicleList(q, rawQ), matched: true };
    }

    return { answer: '', matched: false };
  }

  // --------------------------------------------------------- Intent handlers
  function helpText() {
    return '<b>Trợ lý Hỏi–Đáp dữ liệu Dashboard.</b> Bạn có thể hỏi ví dụ:' +
      '<ul class="ga-ul">' +
      '<li>Xe nào sắp hết hạn đăng kiểm / phù hiệu / phí đường bộ?</li>' +
      '<li>Thông tin biển số 51C-123.45</li>' +
      '<li>Có bao nhiêu xe đang hoạt động? Bao nhiêu tài xế đang làm việc?</li>' +
      '<li>Phạt nguội của SUP … / còn bao nhiêu vụ chưa xử lý / tổng tiền phạt?</li>' +
      '<li>Xe nào đang ở xưởng? Top xe vào xưởng nhiều nhất? Tổng chi phí BTBD?</li>' +
      '<li>Tuyến của NCC … / các tuyến Lấy / tuyến của kho …</li>' +
      '<li>Tài xế tên … / nhân sự chức danh … / yêu cầu tăng cường của bưu cục …</li>' +
      '</ul>' +
      note('Máy nội bộ trả lời tức thì, không cần mạng. Câu phức tạp có thể bật LLM ở ⚙️ Cài đặt.');
  }

  function answerExpiry(q) {
    var v = arr('vehicles');
    if (!v.length) return note('Chưa có dữ liệu xe. Hãy bấm "🔄 Đồng bộ trực tuyến" hoặc Import Excel.');
    var field = 'inspectionExpiry', label = 'Hạn đăng kiểm';
    if (has(q, ['phu hieu'])) { field = 'badgeExpiry'; label = 'Hạn phù hiệu'; }
    else if (has(q, ['phi duong bo', 'duong bo'])) { field = 'roadFeeExpiry'; label = 'Hạn phí đường bộ'; }
    else if (has(q, ['dan su', 'bhds', 'trach nhiem'])) { field = 'liabilityExpiry'; label = 'Hạn BH dân sự'; }
    else if (has(q, ['vat chat', 'bh vat chat', 'bao hiem vat'])) { field = 'insuranceExpiry'; label = 'Hạn BH vật chất'; }
    else if (has(q, ['dang ky'])) { field = 'regCertExpiry'; label = 'Hạn giấy đăng ký'; }

    var today = new Date(); today.setHours(0, 0, 0, 0);
    var horizon = 30; // ngày
    var rows = [];
    v.forEach(function (x) {
      var d = parseDate(x[field]);
      if (!d) return;
      var days = Math.round((d - today) / 86400000);
      if (days <= horizon) rows.push({ x: x, d: d, days: days });
    });
    rows.sort(function (a, b) { return a.days - b.days; });
    if (!rows.length) return note('Không có xe nào ' + esc(label.toLowerCase()) + ' trong vòng ' + horizon + ' ngày tới. 👍');

    var body = rows.slice(0, 40).map(function (r) {
      var st = r.days < 0 ? ('Quá hạn ' + Math.abs(r.days) + ' ngày') : ('Còn ' + r.days + ' ngày');
      return [r.x.plate, r.x.tonnage, r.x.region, fmtDate(r.d), st];
    });
    var overdue = rows.filter(function (r) { return r.days < 0; }).length;
    return '<b>' + esc(label) + ' — sắp/đã hết hạn (≤' + horizon + ' ngày):</b> ' +
      rows.length + ' xe' + (overdue ? ' (trong đó <b>' + overdue + '</b> đã quá hạn)' : '') +
      table(['Biển số', 'Tải trọng', 'Khu vực', label, 'Tình trạng'], body);
  }

  function answerVehicleByPlate(plate) {
    var key = plateKey(plate);
    var v = arr('vehicles');
    var hit = v.filter(function (x) { return plateKey(x.plate).indexOf(key) !== -1; });
    if (!hit.length) {
      // thử trong efficiency/btbd để báo có tồn tại
      return null;
    }
    var out = hit.slice(0, 3).map(function (x) {
      var head = '<b>🚛 ' + esc(x.plate) + '</b>';
      var body = kv([
        ['Tải trọng', x.tonnage], ['Model', x.model], ['Khu vực', x.region],
        ['Tình trạng', x.status], ['Tình trạng xe', x.condition], ['Đội xe', x.fleet],
        ['Hạn đăng kiểm', x.inspectionExpiry], ['Hạn phù hiệu', x.badgeExpiry],
        ['Hạn phí đường bộ', x.roadFeeExpiry], ['Hạn BH dân sự', x.liabilityExpiry],
        ['KM đã chạy', x.totalKm], ['Cảnh báo', x.warning]
      ]);
      // gắn thêm BTBD gần nhất & phạt nếu có
      var extra = '';
      var pk = plateKey(x.plate);
      var f = arr('fines').filter(function (z) { return plateKey(z.plate) === pk; });
      if (f.length) extra += note('🚨 Có <b>' + f.length + '</b> vụ phạt nguội liên quan xe này.');
      var b = arr('btbd').filter(function (z) { return plateKey(z.plate) === pk; });
      if (b.length) extra += note('🔧 Có <b>' + b.length + '</b> lượt BTBD trong lịch sử.');
      return head + body + extra;
    }).join('<hr class="ga-hr">');
    return out;
  }

  function answerVehicleList(q, raw) {
    var v = arr('vehicles');
    if (!v.length) return note('Chưa có dữ liệu xe.');
    var f = v;
    if (has(q, ['hoat dong'])) f = f.filter(function (x) { return noAccent(x.status).indexOf('hoat dong') !== -1; });
    else if (has(q, ['thanh ly'])) f = f.filter(function (x) { return noAccent(x.status).indexOf('thanh ly') !== -1; });
    if (has(q, ['van'])) f = f.filter(function (x) { return noAccent(x.tonnage + ' ' + x.model).indexOf('van') !== -1; });
    var body = f.slice(0, 40).map(function (x) {
      return [x.plate, x.tonnage, x.model, x.region, x.status];
    });
    return '<b>Danh sách xe</b> (' + f.length + (f.length > 40 ? ', hiển thị 40 đầu' : '') + '):' +
      table(['Biển số', 'Tải trọng', 'Model', 'Khu vực', 'Tình trạng'], body);
  }

  function answerVehicleCount(q) {
    var v = arr('vehicles');
    if (!v.length) return note('Chưa có dữ liệu xe.');
    var by = {};
    v.forEach(function (x) { var s = x.status || 'Không rõ'; by[s] = (by[s] || 0) + 1; });
    if (has(q, ['hoat dong'])) return kpi('Xe đang hoạt động', countBy(v, 'status', 'hoat dong'), 'trên tổng ' + v.length + ' xe');
    if (has(q, ['thanh ly'])) return kpi('Xe thanh lý', countBy(v, 'status', 'thanh ly'), 'trên tổng ' + v.length + ' xe');
    var rows = Object.keys(by).map(function (k) { return [k, fmtNum(by[k])]; });
    return '<b>Tổng số xe: ' + v.length + '</b>' + table(['Tình trạng', 'Số lượng'], rows);
  }

  function answerStaff(q, raw) {
    var d = arr('drivers');
    if (!d.length) return note('Chưa có dữ liệu nhân sự.');
    var f = d;
    if (has(q, ['dang lam', 'con lam'])) f = f.filter(function (x) { return noAccent(x.status).indexOf('dang lam') !== -1; });
    else if (has(q, ['nghi viec', 'da nghi'])) f = f.filter(function (x) { return noAccent(x.status).indexOf('nghi') !== -1; });
    // tìm theo tên (ưu tiên sau "tên", rồi tới "tài xế/nhân viên/msnv")
    var name = extractAfter(raw, /t[eê]n\s+([\p{L}\d.\-\s]{2,40})/iu) ||
               extractAfter(raw, /(?:t[àa]i x[eế]|nh[aâ]n vi[eê]n|msnv|mssv)\s+([\p{L}\d.\-\s]{2,40})/iu);
    if (name) {
      var nk = noAccent(name);
      var byName = d.filter(function (x) { return noAccent(x.name).indexOf(nk) !== -1 || noAccent(x.employeeId).indexOf(nk) !== -1; });
      if (byName.length) {
        var body = byName.slice(0, 20).map(function (x) { return [x.employeeId, x.name, x.phone, x.position, x.route, x.status]; });
        return '<b>Nhân sự khớp "' + esc(name.trim()) + '"</b> (' + byName.length + '):' +
          table(['MSNV', 'Họ tên', 'SĐT', 'Chức danh', 'Tuyến', 'Tình trạng'], body);
      }
    }
    // theo chức danh
    var pos = extractAfter(raw, /(?:ch[uứ]c danh|v[ịi] tr[íi])\s+([\p{L}\d.\-\s]{2,40})/iu);
    if (pos) { var pk = noAccent(pos); f = f.filter(function (x) { return noAccent(x.position).indexOf(pk) !== -1; }); }
    var body2 = f.slice(0, 40).map(function (x) { return [x.employeeId, x.name, x.position, x.route, x.status]; });
    return '<b>Nhân sự</b> (' + f.length + (f.length > 40 ? ', 40 đầu' : '') + '):' +
      table(['MSNV', 'Họ tên', 'Chức danh', 'Tuyến', 'Tình trạng'], body2);
  }

  function answerStaffCount(q) {
    var d = arr('drivers');
    if (!d.length) return note('Chưa có dữ liệu nhân sự.');
    if (has(q, ['dang lam', 'con lam'])) return kpi('Đang làm việc', countBy(d, 'status', 'dang lam'), 'trên tổng ' + d.length);
    if (has(q, ['nghi viec', 'da nghi'])) return kpi('Đã nghỉ việc', countBy(d, 'status', 'nghi'), 'trên tổng ' + d.length);
    var by = {}; d.forEach(function (x) { var s = x.status || 'Không rõ'; by[s] = (by[s] || 0) + 1; });
    var rows = Object.keys(by).map(function (k) { return [k, fmtNum(by[k])]; });
    return '<b>Tổng nhân sự: ' + d.length + '</b>' + table(['Tình trạng', 'Số lượng'], rows);
  }

  function answerFines(q, raw) {
    var f = arr('fines');
    if (!f.length) return note('Chưa có dữ liệu phạt nguội.');
    // theo SUP
    var sup = extractAfter(raw, /sup\s+([\p{L}\d.\-\s]{2,40})/iu);
    if (sup) {
      var sk = noAccent(sup);
      var g = f.filter(function (x) { return noAccent(x.sup).indexOf(sk) !== -1; });
      var money = g.reduce(function (s, x) { return s + parseMoney(x.cost); }, 0);
      var body = g.slice(0, 30).map(function (x) { return [x.plate, x.violationTime || x.reportDate, x.violation, fmtNum(parseMoney(x.cost)), x.progress]; });
      return '<b>Phạt nguội — SUP "' + esc(sup.trim()) + '"</b>: ' + g.length + ' vụ, tổng ' + fmtNum(money) + ' đ' +
        table(['BKS', 'Ngày VP', 'Lỗi', 'Chi phí (đ)', 'Tiến độ'], body);
    }
    // chưa xử lý
    if (has(q, ['chua xu ly', 'chua hoan', 'dang xu ly', 'cho xu ly', 'ton dong'])) {
      var pend = f.filter(function (x) { return !/xong|hoan thanh|da dong|closed/.test(noAccent(x.progress)); });
      var body2 = pend.slice(0, 30).map(function (x) { return [x.plate, x.sup, x.violation, fmtNum(parseMoney(x.cost)), x.progress]; });
      return '<b>Phạt nguội chưa hoàn tất: ' + pend.length + ' vụ</b>' +
        table(['BKS', 'SUP', 'Lỗi', 'Chi phí (đ)', 'Tiến độ'], body2);
    }
    // tổng tiền
    if (has(q, ['tong tien', 'tong chi phi', 'bao nhieu tien'])) {
      var total = f.reduce(function (s, x) { return s + parseMoney(x.cost); }, 0);
      return kpi('Tổng chi phí phạt nguội', fmtNum(total) + ' đ', f.length + ' vụ');
    }
    // theo biển số
    var plate = plateIn(raw);
    if (plate) {
      var pk = plateKey(plate);
      var g2 = f.filter(function (x) { return plateKey(x.plate).indexOf(pk) !== -1; });
      var body3 = g2.map(function (x) { return [x.violationTime || x.reportDate, x.location, x.violation, fmtNum(parseMoney(x.cost)), x.sup, x.progress]; });
      return '<b>Phạt nguội của xe ' + esc(plate) + '</b>: ' + g2.length + ' vụ' +
        table(['Ngày VP', 'Nơi VP', 'Lỗi', 'Chi phí (đ)', 'SUP', 'Tiến độ'], body3);
    }
    // mặc định: danh sách gần nhất
    var body4 = f.slice(0, 25).map(function (x) { return [x.plate, x.sup, x.violation, fmtNum(parseMoney(x.cost)), x.progress]; });
    var tot = f.reduce(function (s, x) { return s + parseMoney(x.cost); }, 0);
    return '<b>Phạt nguội</b>: ' + f.length + ' vụ, tổng ' + fmtNum(tot) + ' đ' +
      table(['BKS', 'SUP', 'Lỗi', 'Chi phí (đ)', 'Tiến độ'], body4);
  }

  function answerFineCount(q) {
    var f = arr('fines');
    if (!f.length) return note('Chưa có dữ liệu phạt nguội.');
    if (has(q, ['tong tien', 'bao nhieu tien', 'tong chi phi'])) {
      var tot = f.reduce(function (s, x) { return s + parseMoney(x.cost); }, 0);
      return kpi('Tổng chi phí phạt nguội', fmtNum(tot) + ' đ', f.length + ' vụ');
    }
    if (has(q, ['chua xu ly', 'chua hoan', 'cho xu ly', 'dang xu ly', 'ton dong'])) {
      var pend = f.filter(function (x) { return !/xong|hoan thanh|da dong|closed/.test(noAccent(x.progress)); });
      return kpi('Phạt nguội chưa hoàn tất', pend.length + ' vụ', 'trên tổng ' + f.length);
    }
    return kpi('Tổng số vụ phạt nguội', f.length + ' vụ', 'tổng tiền ' + fmtNum(f.reduce(function (s, x) { return s + parseMoney(x.cost); }, 0)) + ' đ');
  }

  function answerBTBD(q, raw) {
    var b = arr('btbd');
    if (!b.length) return note('Chưa có dữ liệu BTBD.');
    if (has(q, ['top', 'nhieu nhat', 'nhieu lan'])) {
      var cnt = {}; b.forEach(function (x) { var p = x.plate; cnt[p] = (cnt[p] || 0) + 1; });
      var top = Object.keys(cnt).map(function (p) { return [p, cnt[p]]; }).sort(function (a, b2) { return b2[1] - a[1]; }).slice(0, 10);
      return '<b>Top xe vào xưởng nhiều nhất</b>' + table(['BKS', 'Số lượt'], top.map(function (r) { return [r[0], fmtNum(r[1])]; }));
    }
    if (has(q, ['dang o xuong', 'con o xuong', 'chua ra xuong', 'dang sua', 'nao o xuong'])) {
      var inshop = b.filter(function (x) { return !x.outDate || String(x.outDate).trim() === ''; });
      var body = inshop.slice(0, 30).map(function (x) { return [x.plate, x.inDate, x.content, x.garage, x.expectedDate]; });
      return '<b>Xe đang ở xưởng: ' + inshop.length + '</b>' +
        table(['BKS', 'Ngày vào', 'Nội dung', 'Gara', 'Dự kiến xong'], body);
    }
    if (has(q, ['tong chi phi', 'chi phi', 'bao nhieu tien'])) {
      var tot = b.reduce(function (s, x) { return s + parseMoney(x.cost); }, 0);
      return kpi('Tổng chi phí BTBD', fmtNum(tot) + ' đ', b.length + ' lượt vào xưởng');
    }
    var plate = plateIn(raw);
    if (plate) {
      var pk = plateKey(plate);
      var g = b.filter(function (x) { return plateKey(x.plate).indexOf(pk) !== -1; });
      var body2 = g.map(function (x) { return [x.inDate, x.content, x.category, x.garage, x.outDate, fmtNum(parseMoney(x.cost))]; });
      return '<b>Lịch sử BTBD xe ' + esc(plate) + '</b>: ' + g.length + ' lượt' +
        table(['Ngày vào', 'Nội dung', 'Hạng mục', 'Gara', 'Ngày ra', 'Chi phí (đ)'], body2);
    }
    var body3 = b.slice(0, 25).map(function (x) { return [x.plate, x.inDate, x.content, x.garage, x.outDate ? 'Hoàn thành' : 'Đang ở xưởng']; });
    return '<b>Lịch sử BTBD</b> (' + b.length + '):' + table(['BKS', 'Ngày vào', 'Nội dung', 'Gara', 'Trạng thái'], body3);
  }

  function answerBTBDCount(q) {
    var b = arr('btbd');
    if (!b.length) return note('Chưa có dữ liệu BTBD.');
    var inshop = b.filter(function (x) { return !x.outDate || String(x.outDate).trim() === ''; }).length;
    return kpi('Tổng lượt BTBD', b.length, 'đang ở xưởng: ' + inshop + ' xe');
  }

  function answerRoutes(q, raw) {
    var r = arr('routes');
    if (!r.length) return note('Chưa có dữ liệu lịch tải.');
    var f = r;
    // loại hình
    if (has(q, ['phan loai'])) f = f.filter(function (x) { return noAccent(x.type).indexOf('phan loai') !== -1; });
    else if (has(q, ['giao va lay', 'giao lay'])) f = f.filter(function (x) { return noAccent(x.type).indexOf('giao va lay') !== -1; });
    else if (has(q, [' lay', 'tuyen lay', 'loai lay'])) f = f.filter(function (x) { return noAccent(x.type) === 'lay' || noAccent(x.type).indexOf('lay') !== -1; });
    else if (has(q, ['giao'])) f = f.filter(function (x) { return noAccent(x.type).indexOf('giao') !== -1; });
    // NCC
    var ncc = extractAfter(raw, /ncc\s+([\p{L}\d.\-\s]{1,40})/iu);
    if (ncc) { var nk = noAccent(ncc); f = f.filter(function (x) { return noAccent(x.supplier).indexOf(nk) !== -1; }); }
    // kho
    var kho = extractAfter(raw, /(?:kho|b[uư]u c[uụ]c|bc)\s+([\p{L}\d.\-\s]{2,40})/iu);
    if (kho) { var kk = noAccent(kho); f = f.filter(function (x) { return noAccent(x.warehouse).indexOf(kk) !== -1; }); }
    var body = f.slice(0, 40).map(function (x) { return [x.routeName, x.tonnage, x.warehouse, x.type, x.arrival, x.departure, x.supplier]; });
    return '<b>Lịch tải tuyến</b> (' + f.length + (f.length > 40 ? ', 40 đầu' : '') + '):' +
      table(['Tên tuyến', 'Tải trọng', 'Kho/BC', 'Loại hình', 'Tới', 'Rời', 'NCC'], body);
  }

  function answerRouteCount(q) {
    var r = arr('routes');
    if (!r.length) return note('Chưa có dữ liệu lịch tải.');
    var by = {}; r.forEach(function (x) { var t = x.type || 'Không rõ'; by[t] = (by[t] || 0) + 1; });
    var rows = Object.keys(by).map(function (k) { return [k, fmtNum(by[k])]; });
    return '<b>Tổng số tuyến: ' + r.length + '</b>' + table(['Loại hình', 'Số tuyến'], rows);
  }

  function answerReinf(q, raw) {
    var r = arr('reinforcement');
    if (!r.length) return note('Chưa có dữ liệu tải tăng cường.');
    var f = r;
    var kho = extractAfter(raw, /(?:b[uư]u c[uụ]c|kho|bc)\s+([\p{L}\d.\-\s]{2,40})/iu);
    if (kho) { var kk = noAccent(kho); f = f.filter(function (x) { return noAccent(x.warehouse).indexOf(kk) !== -1; }); }
    var ncc = extractAfter(raw, /ncc\s+([\p{L}\d.\-\s]{1,40})/iu);
    if (ncc) { var nk = noAccent(ncc); f = f.filter(function (x) { return noAccent(x.supplier).indexOf(nk) !== -1; }); }
    var body = f.slice(0, 30).map(function (x) { return [x.ticketId, x.warehouse, x.route, x.packages, x.date, x.arrivalTime, x.status, x.supplier]; });
    return '<b>Yêu cầu tải tăng cường</b> (' + f.length + '):' +
      table(['Ticket', 'Bưu cục', 'Lộ trình', 'Kiện', 'Ngày', 'Giờ tới', 'Trạng thái', 'NCC'], body);
  }

  function answerReinfCount() {
    var r = arr('reinforcement');
    if (!r.length) return note('Chưa có dữ liệu tải tăng cường.');
    var by = {}; r.forEach(function (x) { var s = x.status || 'Không rõ'; by[s] = (by[s] || 0) + 1; });
    var rows = Object.keys(by).map(function (k) { return [k, fmtNum(by[k])]; });
    return '<b>Tổng yêu cầu tăng cường: ' + r.length + '</b>' + table(['Trạng thái', 'Số lượng'], rows);
  }

  function answerEfficiency(q, raw) {
    var e = arr('efficiency');
    if (!e.length) return note('Chưa có dữ liệu hiệu suất.');
    var plate = plateIn(raw);
    if (plate) {
      var pk = plateKey(plate);
      var g = e.filter(function (x) { return plateKey(x.plate).indexOf(pk) !== -1; });
      if (g.length) {
        var body = g.map(function (x) { return [x.plate, x.vehicleType, x.tonnage, (x.efficiency != null ? x.efficiency + '%' : '—'), x.opStatus]; });
        return '<b>Hiệu suất xe ' + esc(plate) + '</b>' + table(['Biển số', 'Loại', 'Tải trọng', 'Hiệu suất', 'Tình trạng VH'], body);
      }
    }
    var vals = e.map(function (x) { return typeof x.efficiency === 'number' ? x.efficiency : null; }).filter(function (x) { return x != null; });
    var avg = vals.length ? (vals.reduce(function (s, x) { return s + x; }, 0) / vals.length) : 0;
    return kpi('Hiệu suất sử dụng xe trung bình', avg.toFixed(1) + '%', e.length + ' xe theo dõi');
  }

  function answerOntime(q) {
    var o = getDATA().ontime || {};
    var groups = o.groups || [], weeks = o.weeks || [], weekly = o.weekly || {};
    if (!weeks.length && !Object.keys(weekly).length) return note('Chưa có dữ liệu Ontime.');
    var lastIdx = weeks.length - 1;
    var rows = groups.map(function (g) {
      var series = weekly[g] || [];
      var v = series[lastIdx];
      return [g, (v != null ? (typeof v === 'number' ? (v <= 1 ? (v * 100).toFixed(1) : v.toFixed(1)) + '%' : v) : '—')];
    });
    var wk = weeks[lastIdx] || 'mới nhất';
    return '<b>Ontime theo nhóm tuyến — tuần ' + esc(wk) + '</b>' + table(['Nhóm tuyến', 'Tỷ lệ đúng giờ'], rows);
  }

  // ------------------------------------------------------- small formatters
  function kpi(label, value, sub) {
    return '<div class="ga-kpi"><div class="ga-kpi-v">' + esc(value) + '</div>' +
      '<div class="ga-kpi-l">' + esc(label) + '</div>' +
      (sub ? '<div class="ga-kpi-s">' + esc(sub) + '</div>' : '') + '</div>';
  }
  function countBy(list, field, needleNoAccent) {
    return list.filter(function (x) { return noAccent(x[field]).indexOf(needleNoAccent) !== -1; }).length;
  }
  function extractAfter(text, re) {
    var m = String(text).match(re);
    return m ? m[1].replace(/[?.!,;]+$/, '').trim() : null;
  }
  function parseDate(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number' || (/^\d+(\.\d+)?$/.test(String(v).trim()) && Number(v) > 20000)) {
      var dt = new Date(Math.round((Number(v) - 25569) * 86400000));
      return isNaN(dt) ? null : dt;
    }
    var s = String(v).trim();
    var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/); if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(s); return isNaN(d) ? null : d;
  }
  function fmtDate(d) {
    if (!d) return '—';
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }

  // ==================================================================== LLM
  function buildSnapshot() {
    var d = getDATA();
    var mask = settings.maskPII;
    function maskName(s, i) { return mask ? ('NV#' + i) : s; }
    var snap = {
      tong_quan: {
        so_xe: arr('vehicles').length,
        so_nhan_su: arr('drivers').length,
        so_tuyen: arr('routes').length,
        so_phat_nguoi: arr('fines').length,
        so_btbd: arr('btbd').length,
        so_tang_cuong: arr('reinforcement').length
      },
      vehicles: arr('vehicles').slice(0, 300),
      routes: arr('routes').slice(0, 300),
      fines: arr('fines').slice(0, 300).map(function (x) {
        return Object.assign({}, x, mask ? { driverName: '(ẩn)', driverId: '(ẩn)' } : {});
      }),
      btbd: arr('btbd').slice(0, 300),
      reinforcement: arr('reinforcement').slice(0, 300).map(function (x) {
        return Object.assign({}, x, mask ? { phone: '(ẩn)', employeeId: '(ẩn)', driverInfo: '(ẩn)' } : {});
      }),
      efficiency: arr('efficiency').slice(0, 300),
      drivers: arr('drivers').slice(0, 300).map(function (x, i) {
        return mask ? { name: maskName(x.name, i), position: x.position, route: x.route, status: x.status, seniority: x.seniority }
          : x;
      }),
      ontime: d.ontime || {}
    };
    return snap;
  }

  function systemPrompt() {
    return 'Bạn là trợ lý phân tích dữ liệu vận hành xe tải của GHN (Cụm M12 - KTC HCM). ' +
      'Chỉ trả lời DỰA TRÊN dữ liệu JSON được cung cấp dưới đây; nếu dữ liệu không đủ, nói rõ là không có thông tin. ' +
      'Trả lời tiếng Việt, ngắn gọn, chính xác, ưu tiên số liệu và bảng. Không bịa số.';
  }

  function callLLM(question, cb) {
    var snap;
    try { snap = JSON.stringify(buildSnapshot()); } catch (e) { snap = '{}'; }
    var sys = systemPrompt() + '\n\nDỮ LIỆU:\n' + snap;
    if (settings.provider === 'anthropic') {
      var model = settings.model || 'claude-3-5-haiku-latest';
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': settings.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: model, max_tokens: 1024, system: sys,
          messages: [{ role: 'user', content: question }]
        })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.content && j.content[0] && j.content[0].text) cb(null, j.content[0].text);
        else cb(new Error((j && j.error && j.error.message) || 'LLM không trả lời.'));
      }).catch(function (e) { cb(e); });
    } else {
      var base = settings.baseURL || 'https://api.openai.com/v1';
      var m2 = settings.model || 'gpt-4o-mini';
      fetch(base.replace(/\/$/, '') + '/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Authorization': 'Bearer ' + settings.apiKey },
        body: JSON.stringify({
          model: m2, temperature: 0.2,
          messages: [{ role: 'system', content: sys }, { role: 'user', content: question }]
        })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.choices && j.choices[0] && j.choices[0].message) cb(null, j.choices[0].message.content);
        else cb(new Error((j && j.error && j.error.message) || 'LLM không trả lời.'));
      }).catch(function (e) { cb(e); });
    }
  }

  function llmReady() { return settings.provider !== 'local' && settings.apiKey; }

  // ==================================================================== VIEW
  function injectCSS() {
    var css =
    '.ga-fab{position:fixed;right:22px;bottom:22px;width:56px;height:56px;border-radius:50%;' +
    'background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;border:none;cursor:pointer;' +
    'box-shadow:0 8px 24px rgba(234,88,12,.4);font-size:24px;z-index:9998;display:flex;align-items:center;justify-content:center;transition:transform .15s}' +
    '.ga-fab:hover{transform:scale(1.08)}' +
    '.ga-panel{position:fixed;right:22px;bottom:90px;width:390px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);' +
    'background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.18);z-index:9999;display:none;flex-direction:column;overflow:hidden;font-family:inherit}' +
    '.ga-panel.open{display:flex}' +
    '.ga-head{background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;padding:12px 14px;display:flex;align-items:center;gap:8px}' +
    '.ga-head b{font-size:14px;flex:1}' +
    '.ga-head .ga-sub{font-size:11px;opacity:.9;font-weight:400}' +
    '.ga-ic{background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:14px}' +
    '.ga-ic:hover{background:rgba(255,255,255,.35)}' +
    '.ga-body{flex:1;overflow-y:auto;padding:14px;background:#f8fafc}' +
    '.ga-msg{margin-bottom:12px;display:flex}' +
    '.ga-msg.u{justify-content:flex-end}' +
    '.ga-bub{max-width:88%;padding:9px 12px;border-radius:12px;font-size:13px;line-height:1.5;word-wrap:break-word}' +
    '.ga-msg.u .ga-bub{background:#ea580c;color:#fff;border-bottom-right-radius:3px}' +
    '.ga-msg.a .ga-bub{background:#fff;color:#0f172a;border:1px solid #e5e7eb;border-bottom-left-radius:3px}' +
    '.ga-bub b{font-weight:700}.ga-ul{margin:6px 0 2px;padding-left:18px}.ga-ul li{margin:2px 0}' +
    '.ga-tblwrap{overflow-x:auto;margin:8px 0}' +
    '.ga-tbl{border-collapse:collapse;width:100%;font-size:12px}' +
    '.ga-tbl th{background:#f1f5f9;text-align:left;padding:5px 7px;border:1px solid #e2e8f0;font-weight:700;white-space:nowrap}' +
    '.ga-tbl td{padding:5px 7px;border:1px solid #eef2f7;white-space:nowrap}' +
    '.ga-kv{margin:6px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}' +
    '.ga-kv-row{display:flex;font-size:12px;border-bottom:1px solid #f1f5f9}.ga-kv-row:last-child{border-bottom:none}' +
    '.ga-kv-k{flex:0 0 42%;background:#f8fafc;padding:5px 8px;font-weight:600;color:#475569}' +
    '.ga-kv-v{flex:1;padding:5px 8px}' +
    '.ga-kpi{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 12px;text-align:center;margin:4px 0}' +
    '.ga-kpi-v{font-size:20px;font-weight:800;color:#ea580c}.ga-kpi-l{font-size:12px;color:#475569;font-weight:600}.ga-kpi-s{font-size:11px;color:#94a3b8;margin-top:2px}' +
    '.ga-note{background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;font-size:11.5px;padding:6px 9px;border-radius:8px;margin:6px 0}' +
    '.ga-hr{border:none;border-top:1px dashed #e5e7eb;margin:10px 0}' +
    '.ga-src{font-size:10px;color:#94a3b8;margin-top:4px;text-align:right}' +
    '.ga-foot{padding:10px;border-top:1px solid #e5e7eb;background:#fff;display:flex;gap:8px;align-items:flex-end}' +
    '.ga-in{flex:1;border:1px solid #cbd5e1;border-radius:10px;padding:9px 11px;font-size:13px;resize:none;font-family:inherit;max-height:90px;outline:none}' +
    '.ga-in:focus{border-color:#f97316}' +
    '.ga-send{background:#ea580c;border:none;color:#fff;border-radius:10px;width:40px;height:38px;cursor:pointer;font-size:16px}' +
    '.ga-send:disabled{opacity:.5;cursor:default}' +
    '.ga-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}' +
    '.ga-chip{background:#fff;border:1px solid #fed7aa;color:#c2410c;font-size:11px;padding:4px 9px;border-radius:20px;cursor:pointer}' +
    '.ga-chip:hover{background:#fff7ed}' +
    '.ga-set{padding:14px;overflow-y:auto;font-size:13px}' +
    '.ga-set label{display:block;font-weight:600;margin:10px 0 4px;color:#334155;font-size:12px}' +
    '.ga-set input,.ga-set select{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;font-family:inherit}' +
    '.ga-set .ga-row{display:flex;align-items:center;gap:8px;margin-top:10px}' +
    '.ga-set .ga-row input{width:auto}' +
    '.ga-btn{background:#ea580c;color:#fff;border:none;padding:9px 14px;border-radius:8px;font-weight:700;cursor:pointer;margin-top:14px;font-size:13px}' +
    '.ga-typing{font-size:12px;color:#94a3b8;font-style:italic}' +
    '@media(max-width:480px){.ga-panel{right:8px;left:8px;width:auto;bottom:80px}}';
    var el = document.createElement('style'); el.textContent = css; document.head.appendChild(el);
  }

  var els = {};
  function buildUI() {
    var fab = document.createElement('button');
    fab.className = 'ga-fab'; fab.title = 'Trợ lý Hỏi–Đáp'; fab.innerHTML = '💬';
    document.body.appendChild(fab);

    var panel = document.createElement('div');
    panel.className = 'ga-panel';
    panel.innerHTML =
      '<div class="ga-head">' +
        '<span style="font-size:18px">🤖</span>' +
        '<b>Trợ lý Hỏi–Đáp<br><span class="ga-sub" id="gaMode"></span></b>' +
        '<button class="ga-ic" id="gaSet" title="Cài đặt">⚙️</button>' +
        '<button class="ga-ic" id="gaClose" title="Đóng">✕</button>' +
      '</div>' +
      '<div class="ga-body" id="gaBody"></div>' +
      '<div class="ga-foot">' +
        '<textarea class="ga-in" id="gaIn" rows="1" placeholder="Hỏi về xe, phạt nguội, tuyến, nhân sự..."></textarea>' +
        '<button class="ga-send" id="gaSend" title="Gửi">➤</button>' +
      '</div>' +
      '<div class="ga-set" id="gaSetPanel" style="display:none">' +
        '<label>Bộ não trả lời</label>' +
        '<select id="gaProvider">' +
          '<option value="local">Chỉ máy nội bộ (miễn phí, riêng tư)</option>' +
          '<option value="openai">OpenAI-compatible (API key)</option>' +
          '<option value="anthropic">Anthropic Claude (API key)</option>' +
        '</select>' +
        '<div id="gaLLMFields" style="display:none">' +
          '<label>API key</label><input id="gaKey" type="password" placeholder="dán API key của bạn">' +
          '<label>Model</label><input id="gaModel" placeholder="vd: gpt-4o-mini / claude-3-5-haiku-latest">' +
          '<label>Base URL (OpenAI-compatible, tùy chọn)</label><input id="gaBase" placeholder="https://api.openai.com/v1">' +
          '<div class="ga-row"><input type="checkbox" id="gaMask"><label style="margin:0">Ẩn tên/SĐT/MSNV khi gửi LLM (khuyến nghị)</label></div>' +
          '<div class="ga-row"><input type="checkbox" id="gaPrefer"><label style="margin:0">Luôn ưu tiên LLM (kể cả câu máy nội bộ trả được)</label></div>' +
          '<div class="ga-note">⚠️ Khi dùng LLM, một phần dữ liệu được gửi tới nhà cung cấp API. Trang là public — cân nhắc bật ẩn thông tin cá nhân. API key chỉ lưu trong trình duyệt của bạn (localStorage), không đẩy lên GitHub.</div>' +
        '</div>' +
        '<button class="ga-btn" id="gaSave">Lưu cài đặt</button>' +
      '</div>';
    document.body.appendChild(panel);

    els = {
      fab: fab, panel: panel,
      body: panel.querySelector('#gaBody'),
      input: panel.querySelector('#gaIn'),
      send: panel.querySelector('#gaSend'),
      mode: panel.querySelector('#gaMode'),
      setBtn: panel.querySelector('#gaSet'),
      closeBtn: panel.querySelector('#gaClose'),
      setPanel: panel.querySelector('#gaSetPanel'),
      chatFoot: panel.querySelector('.ga-foot'),
      provider: panel.querySelector('#gaProvider'),
      llmFields: panel.querySelector('#gaLLMFields'),
      key: panel.querySelector('#gaKey'),
      model: panel.querySelector('#gaModel'),
      base: panel.querySelector('#gaBase'),
      mask: panel.querySelector('#gaMask'),
      prefer: panel.querySelector('#gaPrefer'),
      save: panel.querySelector('#gaSave')
    };

    fab.addEventListener('click', togglePanel);
    els.closeBtn.addEventListener('click', function () { panel.classList.remove('open'); });
    els.setBtn.addEventListener('click', toggleSettings);
    els.send.addEventListener('click', onSend);
    els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
    });
    els.input.addEventListener('input', function () {
      els.input.style.height = 'auto'; els.input.style.height = Math.min(els.input.scrollHeight, 90) + 'px';
    });
    els.provider.addEventListener('change', function () {
      els.llmFields.style.display = els.provider.value === 'local' ? 'none' : 'block';
    });
    els.save.addEventListener('click', function () {
      settings.provider = els.provider.value;
      settings.apiKey = els.key.value.trim();
      settings.model = els.model.value.trim();
      settings.baseURL = els.base.value.trim();
      settings.maskPII = els.mask.checked;
      settings.preferLLM = els.prefer.checked;
      saveSettings(settings);
      updateModeLabel();
      toggleSettings();
      addMsg('a', note('✅ Đã lưu cài đặt. Bộ não hiện tại: <b>' + modeName() + '</b>.'));
    });

    // greeting
    addMsg('a', helpText());
    renderChips();
    updateModeLabel();
  }

  function modeName() {
    if (settings.provider === 'local') return 'Máy nội bộ';
    if (settings.provider === 'anthropic') return 'Claude' + (settings.apiKey ? '' : ' (chưa có key)');
    return 'OpenAI' + (settings.apiKey ? '' : ' (chưa có key)');
  }
  function updateModeLabel() {
    els.mode.textContent = 'Bộ não: ' + modeName() + (llmReady() && settings.preferLLM ? ' • ưu tiên LLM' : '');
  }

  function togglePanel() {
    els.panel.classList.toggle('open');
    if (els.panel.classList.contains('open')) setTimeout(function () { els.input.focus(); }, 50);
  }
  function toggleSettings() {
    var showing = els.setPanel.style.display !== 'none';
    if (showing) { els.setPanel.style.display = 'none'; els.body.style.display = ''; els.chatFoot.style.display = ''; }
    else {
      els.provider.value = settings.provider; els.key.value = settings.apiKey;
      els.model.value = settings.model; els.base.value = settings.baseURL;
      els.mask.checked = settings.maskPII; els.prefer.checked = settings.preferLLM;
      els.llmFields.style.display = settings.provider === 'local' ? 'none' : 'block';
      els.setPanel.style.display = 'block'; els.body.style.display = 'none'; els.chatFoot.style.display = 'none';
    }
  }

  function renderChips() {
    var chips = ['Xe sắp hết hạn đăng kiểm', 'Bao nhiêu xe đang hoạt động', 'Phạt nguội chưa xử lý', 'Xe đang ở xưởng', 'Các tuyến Lấy'];
    var wrap = document.createElement('div'); wrap.className = 'ga-chips';
    chips.forEach(function (c) {
      var b = document.createElement('span'); b.className = 'ga-chip'; b.textContent = c;
      b.addEventListener('click', function () { els.input.value = c; onSend(); });
      wrap.appendChild(b);
    });
    els.body.appendChild(wrap); scrollDown();
  }

  function addMsg(who, html) {
    var m = document.createElement('div'); m.className = 'ga-msg ' + who;
    var b = document.createElement('div'); b.className = 'ga-bub'; b.innerHTML = html;
    m.appendChild(b); els.body.appendChild(m); scrollDown();
    return b;
  }
  function scrollDown() { els.body.scrollTop = els.body.scrollHeight; }

  function onSend() {
    var q = els.input.value.trim();
    if (!q) return;
    addMsg('u', esc(q));
    els.input.value = ''; els.input.style.height = 'auto';
    handleQuestion(q);
  }

  function handleQuestion(q) {
    var forceLLM = llmReady() && settings.preferLLM;
    var local = forceLLM ? { matched: false } : runLocal(q);

    if (local.matched) {
      var b = addMsg('a', local.answer);
      var s = document.createElement('div'); s.className = 'ga-src'; s.textContent = 'Nguồn: dữ liệu dashboard (máy nội bộ)';
      b.appendChild(s);
      return;
    }

    if (llmReady()) {
      var typing = addMsg('a', '<span class="ga-typing">Đang hỏi ' + esc(modeName()) + '…</span>');
      callLLM(q, function (err, text) {
        if (err) { typing.innerHTML = note('❌ Lỗi gọi LLM: ' + esc(err.message || String(err)) + '<br>Kiểm tra API key/model/kết nối trong ⚙️ Cài đặt.'); return; }
        typing.innerHTML = mdToHtml(text);
        var s = document.createElement('div'); s.className = 'ga-src'; s.textContent = 'Nguồn: ' + modeName() + ' (dựa trên dữ liệu dashboard)';
        typing.appendChild(s);
      });
      return;
    }

    // không có LLM và máy nội bộ không hiểu
    addMsg('a', 'Mình chưa chắc chắn câu này từ dữ liệu sẵn có. Bạn thử hỏi cụ thể hơn (theo xe/biển số, SUP, NCC, kho, loại tuyến…), ' +
      'hoặc bật LLM ở ⚙️ Cài đặt để trả lời câu phức tạp.' + note('Gõ "giúp gì được" để xem các dạng câu hỏi máy nội bộ trả lời tốt.'));
  }

  // markdown rất gọn cho câu trả lời LLM
  function mdToHtml(t) {
    t = esc(t);
    t = t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    t = t.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>');
    t = t.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul class="ga-ul">$1</ul>');
    t = t.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
    return t;
  }

  // ================================================================== INIT
  function init() {
    injectCSS();
    buildUI();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Xuất ra để tiện gỡ lỗi / test
  window.GHNAssistant = { runLocal: runLocal, buildSnapshot: buildSnapshot };
})();
