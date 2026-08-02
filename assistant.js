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

    // 0.5) CHẾ ĐỘ PHÂN TÍCH: tổng hợp / phân tích / so sánh / nhận xét / khuyến nghị
    var anaTopic = topicOf(q);
    var strongAna = has(q, ['phan tich', 'tong hop', 'bao cao', 'tong quan', 'tinh hinh', 'danh gia', 'xu huong', 'khuyen nghi', 'de xuat', 'insight', 'nhan xet']);
    var wantCompare = has(q, ['so sanh', ' vs ', 'doi chieu']);
    var monthsAsked = monthsIn(q);
    if (strongAna || wantCompare || (monthsAsked.length && (anaTopic || lastTopic))) {
      var topic = anaTopic || lastTopic || 'overview';
      lastTopic = (topic === 'overview') ? lastTopic : topic;
      if (wantCompare || monthsAsked.length >= 2) return { answer: compareMonths(topic, monthsAsked), matched: true };
      if (monthsAsked.length === 1) return { answer: analyzeMonth(topic, monthsAsked[0]), matched: true };
      return { answer: analyzeTopic(topic), matched: true };
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
    return '<b>Trợ lý Hỏi–Đáp & Phân tích dữ liệu Dashboard.</b>' +
      '<div style="margin-top:4px"><b>🧠 Phân tích - tổng hợp:</b></div>' +
      '<ul class="ga-ul">' +
      '<li>Phân tích tổng quan / phạt nguội / tăng cường / BTBD / chi phí / đội xe</li>' +
      '<li>So sánh tăng cường tháng 6 và tháng 7 • Phạt nguội tháng 7 thế nào?</li>' +
      '<li>Sau đó hỏi tiếp gọn: "còn tháng 5?" — trợ lý nhớ ngữ cảnh</li>' +
      '</ul>' +
      '<div><b>🔍 Tra cứu nhanh:</b></div>' +
      '<ul class="ga-ul">' +
      '<li>Xe nào sắp hết hạn đăng kiểm? • Thông tin biển số 51C-123.45</li>' +
      '<li>Phạt nguội chưa xử lý • Xe đang ở xưởng • Các tuyến Lấy • Tài xế tên …</li>' +
      '</ul>' +
      note('Trả lời tức thì trong trình duyệt, dữ liệu không rời máy. Bật LLM ở ⚙️ nếu cần hội thoại tự do hơn.');
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
      var pend = f.filter(function (x) { return !/xong|hoan thanh|da dong|eform|closed/.test(noAccent(x.progress)); });
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
      var pend = f.filter(function (x) { return !/xong|hoan thanh|da dong|eform|closed/.test(noAccent(x.progress)); });
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

  // ================================================ MODULE PHÂN TÍCH ("AI mode")
  var lastTopic = null; // ngữ cảnh hội thoại: nhớ chủ đề gần nhất

  function topicOf(q) {
    if (has(q, ['tang cuong'])) return 'reinf';
    if (has(q, ['phat', 'vi pham'])) return 'fines';
    if (has(q, ['btbd', 'bao tri', 'sua chua', 'xuong'])) return 'btbd';
    if (has(q, ['chi phi'])) return 'cost';
    if (has(q, ['ontime', 'dung gio'])) return 'ontime';
    if (has(q, ['nhan su', 'tai xe'])) return 'staff';
    if (has(q, ['doi xe', 'xe tai', 'phuong tien', 'dang kiem'])) return 'fleet';
    return null;
  }
  function monthsIn(q) {
    var out = []; var re = /thang\s*(\d{1,2})/g, m;
    while ((m = re.exec(q))) { var n = parseInt(m[1], 10); if (n >= 1 && n <= 12 && out.indexOf(n) === -1) out.push(n); }
    return out;
  }
  function pct(x, d) { return x == null ? '—' : (x * 100).toFixed(d == null ? 1 : d) + '%'; }
  function arrow(v, goodUp) { // goodUp: tăng là tốt?
    if (v == null) return '';
    var up = v > 0, good = goodUp ? up : !up;
    var col = v === 0 ? 'var(--text-muted)' : (good ? '#16a34a' : '#dc2626');
    var sym = v === 0 ? '•' : (up ? '▲' : '▼');
    return '<span style="color:' + col + ';font-weight:700">' + sym + '</span>';
  }
  function chips(list) {
    return '<div class="ga-chips">' + list.map(function (c) { return '<span class="ga-chip">' + esc(c) + '</span>'; }).join('') + '</div>';
  }
  function secTitle(t) { return '<div style="font-weight:800;margin:8px 0 4px;color:#0e8a80">' + t + '</div>'; }

  // ---- gộp theo tháng cho từng mảng dữ liệu ----
  function monthKeyLoose(v) {
    try { if (typeof monthKeyFromDate === 'function') return monthKeyFromDate(v); } catch (e) {}
    if (v == null || v === '') return null;
    var s = String(v).trim();
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return m[3] + '-' + ('0' + m[2]).slice(-2);
    m = s.match(/^(\d{4})-(\d{1,2})/); if (m) return m[1] + '-' + ('0' + m[2]).slice(-2);
    return null;
  }
  function reinfMonthKey(x) {
    try { if (typeof reinfDateOf === 'function') { var d = reinfDateOf(x); if (d) return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); } } catch (e) {}
    return monthKeyLoose(x.ts || x.requestDate);
  }
  function finePaid(x) {
    var p = noAccent(x.progress);
    if (!p) return 'unknown';
    if (p.indexOf('da dong') !== -1 || p.indexOf('eform') !== -1) return 'paid';
    return 'unpaid';
  }
  function reinfMonthly() {
    var by = {};
    arr('reinforcement').forEach(function (x) {
      var k = reinfMonthKey(x); if (!k) return;
      var o = by[k] || (by[k] = { t: 0, ok: 0, no: 0, cancel: 0 });
      o.t++;
      var st = noAccent(x.status);
      if (st.indexOf('co xe') === 0) o.ok++;
      else if (st.indexOf('khong co xe') === 0) o.no++;
      else if (st.indexOf('huy') === 0) o.cancel++;
    });
    return by;
  }
  function finesMonthly() {
    var by = {};
    arr('fines').forEach(function (x) {
      var k = monthKeyLoose(x.violationTime || x.reportDate); if (!k) return;
      var o = by[k] || (by[k] = { n: 0, cost: 0, paidN: 0, paidC: 0, unpaidN: 0, unpaidC: 0 });
      var c = parseMoney(x.cost); o.n++; o.cost += c;
      var s = finePaid(x);
      if (s === 'paid') { o.paidN++; o.paidC += c; } else if (s === 'unpaid') { o.unpaidN++; o.unpaidC += c; }
    });
    return by;
  }
  function btbdMonthly() {
    var by = {};
    arr('btbd').forEach(function (x) {
      var k = monthKeyLoose(x.inDate); if (!k) return;
      var o = by[k] || (by[k] = { n: 0, cost: 0 });
      o.n++; o.cost += parseMoney(x.cost);
    });
    return by;
  }
  function keyForMonth(by, mNum) { // chọn key năm mới nhất có tháng đó
    var keys = Object.keys(by).filter(function (k) { return parseInt(k.slice(5), 10) === mNum; }).sort();
    return keys.length ? keys[keys.length - 1] : null;
  }
  function prevKey(by, key) {
    var keys = Object.keys(by).sort(); var i = keys.indexOf(key);
    return i > 0 ? keys[i - 1] : null;
  }
  function lastKeys(by, n) { return Object.keys(by).sort().slice(-n); }
  function mLabel(k) { return k ? (k.slice(5) + '/' + k.slice(0, 4)) : '—'; }

  // ---- PHÂN TÍCH TỪNG CHỦ ĐỀ ----
  function analyzeTopic(topic) {
    if (topic === 'fines') return analyzeFines();
    if (topic === 'reinf') return analyzeReinf();
    if (topic === 'btbd') return analyzeBTBD();
    if (topic === 'cost') return analyzeCost();
    if (topic === 'fleet') return analyzeFleet();
    if (topic === 'ontime') return answerOntime('');
    if (topic === 'staff') return analyzeStaff();
    return analyzeOverview();
  }

  function analyzeOverview() {
    var v = arr('vehicles'), d = arr('drivers'), f = arr('fines'), b = arr('btbd'), r = arr('reinforcement');
    var vAct = v.filter(function (x) { return noAccent(x.status).indexOf('hoat dong') !== -1; }).length;
    var dAct = d.filter(function (x) { return noAccent(x.status).indexOf('dang lam') !== -1; }).length;
    var fCost = f.reduce(function (s, x) { return s + parseMoney(x.cost); }, 0);
    var fUnpaid = f.filter(function (x) { return finePaid(x) === 'unpaid'; });
    var fUnpaidC = fUnpaid.reduce(function (s, x) { return s + parseMoney(x.cost); }, 0);
    var bCost = b.reduce(function (s, x) { return s + parseMoney(x.cost); }, 0);
    var inShop = b.filter(function (x) { return !x.outDate || String(x.outDate).trim() === ''; }).length;
    var rm = reinfMonthly(); var rk = lastKeys(rm, 2);
    var rLast = rk.length ? rm[rk[rk.length - 1]] : null;
    var rPrev = rk.length > 1 ? rm[rk[0]] : null;
    var rateL = rLast && (rLast.ok + rLast.no) ? rLast.ok / (rLast.ok + rLast.no) : null;
    var rateP = rPrev && (rPrev.ok + rPrev.no) ? rPrev.ok / (rPrev.ok + rPrev.no) : null;

    var html = '<b>📋 BÁO CÁO TỔNG QUAN VẬN HÀNH</b>' +
      kv([
        ['Đội xe', vAct + '/' + v.length + ' xe hoạt động'],
        ['Nhân sự', dAct + '/' + d.length + ' đang làm việc'],
        ['Xe đang ở xưởng (BTBD)', inShop + ' xe — tổng chi phí BTBD ' + fmtNum(bCost) + ' đ'],
        ['Phạt nguội', f.length + ' vụ — ' + fmtNum(fCost) + ' đ (chưa đóng: ' + fUnpaid.length + ' vụ / ' + fmtNum(fUnpaidC) + ' đ)'],
        ['Tăng cường tháng ' + (rk.length ? mLabel(rk[rk.length - 1]) : '—'), rLast ? (rLast.t + ' yêu cầu, đáp ứng ' + pct(rateL)) : '—']
      ]);
    var notes = [];
    if (rateL != null && rateP != null) {
      var dR = (rateL - rateP) * 100;
      notes.push(arrow(dR, true) + ' Tỷ lệ đáp ứng tăng cường ' + (dR >= 0 ? 'tăng ' : 'giảm ') + Math.abs(dR).toFixed(1) + ' điểm % so tháng trước.');
    }
    if (fUnpaid.length) notes.push('⚠️ Còn <b>' + fUnpaid.length + ' vụ phạt chưa đóng</b> (' + fmtNum(fUnpaidC) + ' đ) — ưu tiên truy thu, nhất là tài xế sắp/đã nghỉ việc.');
    if (inShop) notes.push('🔧 ' + inShop + ' xe đang nằm xưởng — kiểm tra ngày dự kiến xong để không hụt nguồn xe đầu tuần.');
    html += secTitle('Nhận xét') + notes.map(function (n) { return '<div style="margin:2px 0">' + n + '</div>'; }).join('');
    html += chips(['Phân tích phạt nguội', 'Phân tích tăng cường', 'Phân tích chi phí', 'Xe nào sắp hết hạn đăng kiểm']);
    return html;
  }

  function analyzeFines() {
    var f = arr('fines');
    if (!f.length) return note('Chưa có dữ liệu phạt nguội.');
    var plates = {}; var total = 0, paidN = 0, paidC = 0, unpaidN = 0, unpaidC = 0;
    var quitUnpaid = 0;
    f.forEach(function (x) {
      var c = parseMoney(x.cost); total += c;
      var p = x.plate || 'N/A'; var o = plates[p] || (plates[p] = { n: 0, c: 0, u: 0 });
      o.n++; o.c += c;
      var s = finePaid(x);
      if (s === 'paid') { paidN++; paidC += c; }
      else if (s === 'unpaid') {
        unpaidN++; unpaidC += c; o.u++;
        if (noAccent(x.driverStatus).indexOf('nghi') !== -1) quitUnpaid++;
      }
    });
    var top = Object.keys(plates).map(function (p) { return [p, plates[p]]; }).sort(function (a, b) { return b[1].c - a[1].c; }).slice(0, 5);
    var bm = finesMonthly(); var mk = lastKeys(bm, 4);

    var html = '<b>🚨 PHÂN TÍCH PHẠT NGUỘI</b>' +
      kv([
        ['Tổng vụ / số xe', f.length + ' vụ / ' + Object.keys(plates).length + ' xe'],
        ['Tổng chi phí', fmtNum(total) + ' đ'],
        ['Đã đóng', paidN + ' vụ — ' + fmtNum(paidC) + ' đ (' + pct((paidN + unpaidN) ? paidN / (paidN + unpaidN) : null, 0) + ')'],
        ['Chưa đóng', unpaidN + ' vụ — ' + fmtNum(unpaidC) + ' đ']
      ]) +
      secTitle('Top xe theo chi phí phạt') +
      table(['BKS', 'Số vụ', 'Chi phí (đ)', 'Chưa đóng'], top.map(function (t) { return [t[0], t[1].n, fmtNum(t[1].c), t[1].u ? (t[1].u + ' vụ') : '—']; }));
    if (mk.length > 1) {
      html += secTitle('Diễn biến theo tháng') +
        table(['Tháng', 'Số vụ', 'Chi phí (đ)'], mk.map(function (k) { return [mLabel(k), bm[k].n, fmtNum(bm[k].cost)]; }));
    }
    var notes = [];
    if (unpaidN) notes.push('⚠️ Tồn <b>' + unpaidN + ' vụ / ' + fmtNum(unpaidC) + ' đ</b> chưa đóng — chiếm ' + pct(total ? unpaidC / total : null, 0) + ' tổng chi phí phạt.');
    if (quitUnpaid) notes.push('🔴 <b>' + quitUnpaid + ' vụ chưa đóng dính tài xế đã/đang nghỉ việc</b> — rủi ro mất truy thu cao nhất, xử lý trước (giữ cọc/lương còn lại).');
    if (top.length && top[0][1].n >= 3) notes.push('🚛 Xe ' + esc(top[0][0]) + ' bị ' + top[0][1].n + ' vụ — kiểm tra tài xế phụ trách tuyến, cân nhắc đào tạo lại/đổi tài.');
    html += secTitle('Nhận xét & khuyến nghị') + notes.map(function (n) { return '<div style="margin:2px 0">' + n + '</div>'; }).join('');
    html += chips(['Phạt nguội chưa xử lý', 'So sánh phạt nguội theo tháng', 'Phân tích chi phí']);
    return html;
  }

  function analyzeReinf() {
    var by = reinfMonthly();
    var keys = Object.keys(by).sort();
    if (!keys.length) return note('Chưa có dữ liệu tăng cường.');
    var rows = keys.map(function (k) {
      var o = by[k], real = o.ok + o.no;
      return [mLabel(k), o.t, o.ok, o.no, real ? pct(o.ok / real) : '—'];
    });
    var tot = keys.reduce(function (s, k) { var o = by[k]; s.t += o.t; s.ok += o.ok; s.no += o.no; return s; }, { t: 0, ok: 0, no: 0 });
    var totRate = (tot.ok + tot.no) ? tot.ok / (tot.ok + tot.no) : null;
    var lastK = keys[keys.length - 1], prevK = keys.length > 1 ? keys[keys.length - 2] : null;
    var l = by[lastK], p = prevK ? by[prevK] : null;
    var lRate = (l.ok + l.no) ? l.ok / (l.ok + l.no) : null;
    var pRate = p && (p.ok + p.no) ? p.ok / (p.ok + p.no) : null;

    var html = '<b>📦 PHÂN TÍCH TẢI TĂNG CƯỜNG</b>' +
      kv([
        ['Toàn kỳ', tot.t + ' yêu cầu — đáp ứng ' + pct(totRate)],
        ['Tháng gần nhất (' + mLabel(lastK) + ')', l.t + ' yêu cầu — đáp ứng ' + pct(lRate)]
      ]) +
      secTitle('Theo tháng') +
      table(['Tháng', 'Yêu cầu', 'Có xe', 'Không xe', '% Đáp ứng'], rows);
    var notes = [];
    if (pRate != null && lRate != null) {
      var d = (lRate - pRate) * 100;
      notes.push(arrow(d, true) + ' Đáp ứng ' + (d >= 0 ? 'tăng' : 'giảm') + ' ' + Math.abs(d).toFixed(1) + ' điểm % so tháng ' + mLabel(prevK) + '; khối lượng ' + (l.t >= p.t ? 'tăng' : 'giảm') + ' ' + Math.abs(l.t - p.t) + ' yêu cầu.');
    }
    if (lRate != null && lRate < 0.85) notes.push('⚠️ Đáp ứng dưới 85% — chốt trước nguồn xe cho ngày cao điểm (thứ Hai & D+1 sau event) với NCC theo giá cam kết.');
    if (lRate != null && lRate >= 0.9) notes.push('✅ Đáp ứng ≥90% — duy trì cơ chế điều phối hiện tại.');
    html += secTitle('Nhận xét & khuyến nghị') + notes.map(function (n) { return '<div style="margin:2px 0">' + n + '</div>'; }).join('');
    html += chips(['So sánh tăng cường tháng ' + (prevK ? parseInt(prevK.slice(5), 10) : 6) + ' và tháng ' + parseInt(lastK.slice(5), 10), 'Yêu cầu tăng cường của NCC', 'Phân tích tổng quan']);
    return html;
  }

  function analyzeBTBD() {
    var b = arr('btbd');
    if (!b.length) return note('Chưa có dữ liệu BTBD.');
    var total = b.reduce(function (s, x) { return s + parseMoney(x.cost); }, 0);
    var inShop = b.filter(function (x) { return !x.outDate || String(x.outDate).trim() === ''; });
    var byVeh = {};
    b.forEach(function (x) { var p = x.plate || 'N/A'; var o = byVeh[p] || (byVeh[p] = { n: 0, c: 0 }); o.n++; o.c += parseMoney(x.cost); });
    var top = Object.keys(byVeh).map(function (p) { return [p, byVeh[p]]; }).sort(function (a, b2) { return b2[1].c - a[1].c; }).slice(0, 5);
    var topShare = total ? top.reduce(function (s, t) { return s + t[1].c; }, 0) / total : 0;
    var bm = btbdMonthly(); var mk = lastKeys(bm, 4);

    var html = '<b>🔧 PHÂN TÍCH BẢO TRÌ - SỬA CHỮA (BTBD)</b>' +
      kv([
        ['Tổng lượt / chi phí', b.length + ' lượt — ' + fmtNum(total) + ' đ'],
        ['Bình quân / lượt', fmtNum(b.length ? total / b.length : 0) + ' đ'],
        ['Đang ở xưởng', inShop.length + ' xe']
      ]) +
      secTitle('Top xe chi phí BTBD') +
      table(['BKS', 'Lượt', 'Chi phí (đ)'], top.map(function (t) { return [t[0], t[1].n, fmtNum(t[1].c)]; }));
    if (mk.length > 1) {
      html += secTitle('Theo tháng') + table(['Tháng', 'Lượt', 'Chi phí (đ)'], mk.map(function (k) { return [mLabel(k), bm[k].n, fmtNum(bm[k].cost)]; }));
    }
    var notes = [];
    notes.push('📌 Top 5 xe chiếm <b>' + pct(topShare, 0) + '</b> tổng chi phí BTBD — đúng nguyên tắc 80:20, tập trung đánh giá thanh lý/đại tu nhóm này trước.');
    if (inShop.length) notes.push('🔧 ' + inShop.length + ' xe đang nằm xưởng — đối chiếu "ngày dự kiến xong" và đôn đốc gara.');
    html += secTitle('Nhận xét & khuyến nghị') + notes.map(function (n) { return '<div style="margin:2px 0">' + n + '</div>'; }).join('');
    html += chips(['Xe nào đang ở xưởng', 'Top xe vào xưởng nhiều nhất', 'Phân tích chi phí']);
    return html;
  }

  function analyzeCost() {
    var b = arr('btbd'), f = arr('fines');
    var bC = b.reduce(function (s, x) { return s + parseMoney(x.cost); }, 0);
    var fC = f.reduce(function (s, x) { return s + parseMoney(x.cost); }, 0);
    var total = bC + fC;
    if (!total) return note('Chưa có dữ liệu chi phí.');
    var fUnpaidC = f.filter(function (x) { return finePaid(x) === 'unpaid'; }).reduce(function (s, x) { return s + parseMoney(x.cost); }, 0);
    var bm = btbdMonthly(); var mk = lastKeys(bm, 3);
    var html = '<b>💰 PHÂN TÍCH CHI PHÍ VẬN HÀNH</b>' +
      kv([
        ['Chi phí BTBD', fmtNum(bC) + ' đ (' + pct(bC / total, 0) + ')'],
        ['Chi phí phạt nguội', fmtNum(fC) + ' đ (' + pct(fC / total, 1) + ') — chưa thu hồi ' + fmtNum(fUnpaidC) + ' đ'],
        ['Tổng', fmtNum(total) + ' đ']
      ]);
    if (mk.length) html += secTitle('BTBD 3 tháng gần nhất') + table(['Tháng', 'Lượt', 'Chi phí (đ)'], mk.map(function (k) { return [mLabel(k), bm[k].n, fmtNum(bm[k].cost)]; }));
    var notes = ['📌 Đòn bẩy chi phí nằm ở BTBD (' + pct(bC / total, 0) + '): chuẩn hóa định mức bảo dưỡng theo KM, so giá gara định kỳ.',
      '⚖️ Phạt nguội nhỏ về tiền nhưng là chỉ số kỷ luật vận hành — mục tiêu 100% truy thu trong 15 ngày.'];
    var html2 = html + secTitle('Nhận xét & khuyến nghị') + notes.map(function (n) { return '<div style="margin:2px 0">' + n + '</div>'; }).join('');
    return html2 + chips(['Phân tích BTBD', 'Phân tích phạt nguội', 'Top xe chi phí BTBD']);
  }

  function analyzeFleet() {
    var v = arr('vehicles');
    if (!v.length) return note('Chưa có dữ liệu xe.');
    var by = {}; v.forEach(function (x) { var s = x.status || 'Không rõ'; by[s] = (by[s] || 0) + 1; });
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var expiring = 0, overdue = 0;
    v.forEach(function (x) {
      ['inspectionExpiry', 'badgeExpiry', 'roadFeeExpiry', 'liabilityExpiry'].forEach(function (fld) {
        var d = parseDate(x[fld]); if (!d) return;
        var days = Math.round((d - today) / 86400000);
        if (days < 0) overdue++; else if (days <= 30) expiring++;
      });
    });
    var e = arr('efficiency');
    var effVals = e.map(function (x) { return typeof x.efficiency === 'number' ? x.efficiency : null; }).filter(function (x) { return x != null; });
    var avgEff = effVals.length ? effVals.reduce(function (s, x) { return s + x; }, 0) / effVals.length : null;
    var html = '<b>🚛 PHÂN TÍCH ĐỘI XE</b>' +
      kv([['Tổng xe', v.length], ['Hiệu suất sử dụng TB', avgEff != null ? avgEff.toFixed(1) + '%' : '—'],
          ['Giấy tờ sắp hết hạn (≤30 ngày)', expiring + ' mục'], ['Giấy tờ QUÁ HẠN', overdue + ' mục']]) +
      secTitle('Theo tình trạng') + table(['Tình trạng', 'Số xe'], Object.keys(by).map(function (k) { return [k, by[k]]; }));
    var notes = [];
    if (overdue) notes.push('🔴 Có <b>' + overdue + ' mục giấy tờ quá hạn</b> — dừng điều xe liên quan cho tới khi gia hạn, tránh phạt nguội kép.');
    if (expiring) notes.push('⚠️ ' + expiring + ' mục sắp hết hạn trong 30 ngày — lên lịch đăng kiểm/gia hạn ngay tuần này.');
    html += secTitle('Nhận xét & khuyến nghị') + notes.map(function (n) { return '<div style="margin:2px 0">' + n + '</div>'; }).join('');
    return html + chips(['Xe nào sắp hết hạn đăng kiểm', 'Hiệu suất sử dụng xe', 'Phân tích BTBD']);
  }

  function analyzeStaff() {
    var d = arr('drivers');
    if (!d.length) return note('Chưa có dữ liệu nhân sự.');
    var act = d.filter(function (x) { return noAccent(x.status).indexOf('dang lam') !== -1; }).length;
    var quit = d.filter(function (x) { return noAccent(x.status).indexOf('nghi') !== -1; }).length;
    var byPos = {}; d.forEach(function (x) { var p = x.position || 'Khác'; byPos[p] = (byPos[p] || 0) + 1; });
    var html = '<b>👥 PHÂN TÍCH NHÂN SỰ</b>' +
      kv([['Tổng', d.length], ['Đang làm việc', act], ['Đã nghỉ', quit + ' (' + pct(d.length ? quit / d.length : null, 0) + ')']]) +
      secTitle('Theo chức danh') + table(['Chức danh', 'Số người'], Object.keys(byPos).map(function (k) { return [k, byPos[k]]; }));
    return html + chips(['Tài xế đang làm việc', 'Phân tích tổng quan']);
  }

  // ---- THEO THÁNG CỤ THỂ & SO SÁNH ----
  function analyzeMonth(topic, mNum) {
    var by = topic === 'fines' ? finesMonthly() : topic === 'btbd' ? btbdMonthly() : reinfMonthly();
    var key = keyForMonth(by, mNum);
    if (!key) return note('Không có dữ liệu tháng ' + mNum + ' cho chủ đề này.');
    var pk = prevKey(by, key);
    if (topic === 'fines') {
      var o = by[key], p = pk ? by[pk] : null;
      var html = '<b>🚨 Phạt nguội tháng ' + mLabel(key) + '</b>' +
        kv([['Số vụ', o.n + (p ? ' (' + (o.n >= p.n ? '+' : '') + (o.n - p.n) + ' vs ' + mLabel(pk) + ')' : '')],
            ['Chi phí', fmtNum(o.cost) + ' đ'], ['Đã đóng', o.paidN + ' vụ — ' + fmtNum(o.paidC) + ' đ'], ['Chưa đóng', o.unpaidN + ' vụ — ' + fmtNum(o.unpaidC) + ' đ']]);
      return html + chips(['Phân tích phạt nguội', 'So sánh phạt nguội theo tháng']);
    }
    if (topic === 'btbd') {
      var o2 = by[key], p2 = pk ? by[pk] : null;
      return '<b>🔧 BTBD tháng ' + mLabel(key) + '</b>' +
        kv([['Lượt vào xưởng', o2.n + (p2 ? ' (' + (o2.n >= p2.n ? '+' : '') + (o2.n - p2.n) + ' vs ' + mLabel(pk) + ')' : '')],
            ['Chi phí', fmtNum(o2.cost) + ' đ' + (p2 ? ' (' + (o2.cost >= p2.cost ? '+' : '−') + fmtNum(Math.abs(o2.cost - p2.cost)) + ')' : '')]]) +
        chips(['Phân tích BTBD', 'Top xe chi phí BTBD']);
    }
    var o3 = by[key], p3 = pk ? by[pk] : null;
    var real = o3.ok + o3.no, rate = real ? o3.ok / real : null;
    var pReal = p3 ? p3.ok + p3.no : 0, pRate = pReal ? p3.ok / pReal : null;
    var lines = [['Yêu cầu', o3.t + (p3 ? ' (' + (o3.t >= p3.t ? '+' : '') + (o3.t - p3.t) + ' vs ' + mLabel(pk) + ')' : '')],
      ['Có xe / Không xe / Hủy', o3.ok + ' / ' + o3.no + ' / ' + o3.cancel],
      ['% Đáp ứng', pct(rate) + (pRate != null && rate != null ? ' (' + ((rate - pRate) * 100 >= 0 ? '+' : '') + ((rate - pRate) * 100).toFixed(1) + ' đ% vs ' + mLabel(pk) + ')' : '')]];
    return '<b>📦 Tăng cường tháng ' + mLabel(key) + '</b>' + kv(lines) +
      chips(['Phân tích tăng cường', 'So sánh tăng cường theo tháng']);
  }

  function compareMonths(topic, monthsAsked) {
    var by = topic === 'fines' ? finesMonthly() : topic === 'btbd' ? btbdMonthly() : reinfMonthly();
    var keys;
    if (monthsAsked.length >= 2) {
      keys = monthsAsked.slice(0, 2).map(function (m) { return keyForMonth(by, m); }).filter(Boolean);
    } else {
      keys = lastKeys(by, 2);
    }
    if (keys.length < 2) return note('Chưa đủ dữ liệu 2 kỳ để so sánh.');
    var a = by[keys[0]], b = by[keys[1]];
    var la = mLabel(keys[0]), lb = mLabel(keys[1]);
    if (topic === 'fines') {
      return '<b>⚖️ So sánh phạt nguội: ' + la + ' vs ' + lb + '</b>' +
        table(['Chỉ tiêu', la, lb, 'Δ'], [
          ['Số vụ', a.n, b.n, (b.n - a.n >= 0 ? '+' : '') + (b.n - a.n)],
          ['Chi phí (đ)', fmtNum(a.cost), fmtNum(b.cost), (b.cost - a.cost >= 0 ? '+' : '−') + fmtNum(Math.abs(b.cost - a.cost))],
          ['Chưa đóng (vụ)', a.unpaidN, b.unpaidN, (b.unpaidN - a.unpaidN >= 0 ? '+' : '') + (b.unpaidN - a.unpaidN)]
        ]) + chips(['Phân tích phạt nguội']);
    }
    if (topic === 'btbd') {
      return '<b>⚖️ So sánh BTBD: ' + la + ' vs ' + lb + '</b>' +
        table(['Chỉ tiêu', la, lb, 'Δ'], [
          ['Lượt vào xưởng', a.n, b.n, (b.n - a.n >= 0 ? '+' : '') + (b.n - a.n)],
          ['Chi phí (đ)', fmtNum(a.cost), fmtNum(b.cost), (b.cost - a.cost >= 0 ? '+' : '−') + fmtNum(Math.abs(b.cost - a.cost))]
        ]) + chips(['Phân tích BTBD']);
    }
    var ra = (a.ok + a.no) ? a.ok / (a.ok + a.no) : null, rb = (b.ok + b.no) ? b.ok / (b.ok + b.no) : null;
    var d = (ra != null && rb != null) ? (rb - ra) * 100 : null;
    var html = '<b>⚖️ So sánh tăng cường: ' + la + ' vs ' + lb + '</b>' +
      table(['Chỉ tiêu', la, lb, 'Δ'], [
        ['Yêu cầu', a.t, b.t, (b.t - a.t >= 0 ? '+' : '') + (b.t - a.t)],
        ['Có xe', a.ok, b.ok, (b.ok - a.ok >= 0 ? '+' : '') + (b.ok - a.ok)],
        ['Không có xe', a.no, b.no, (b.no - a.no >= 0 ? '+' : '') + (b.no - a.no)],
        ['% Đáp ứng', pct(ra), pct(rb), d != null ? ((d >= 0 ? '+' : '') + d.toFixed(1) + ' đ%') : '—']
      ]);
    if (d != null) html += '<div style="margin-top:4px">' + arrow(d, true) + ' ' + (d >= 0 ? 'Cải thiện' : 'Suy giảm') + ' ' + Math.abs(d).toFixed(1) + ' điểm % về khả năng đáp ứng.' + '</div>';
    return html + chips(['Phân tích tăng cường']);
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
    return 'Bạn là trợ lý vận hành xe tải của GHN (Cụm M12 - KTC HCM), trò chuyện tự nhiên như một đồng nghiệp giàu kinh nghiệm logistics. ' +
      'Ưu tiên trả lời DỰA TRÊN dữ liệu JSON bên dưới (xe, phạt nguội, BTBD, lịch tải, tăng cường, nhân sự, ontime); nếu dữ liệu không đủ, nói rõ và trả lời bằng kiến thức chung nếu phù hợp. ' +
      'Khi phân tích: nêu số liệu, tỷ lệ, so sánh tăng/giảm, điểm tốt/chưa tốt, rồi khuyến nghị theo nguyên tắc 80:20. ' +
      'Nhớ ngữ cảnh các câu trước trong hội thoại. Trả lời tiếng Việt, súc tích, dùng markdown (đậm, gạch đầu dòng) khi giúp dễ đọc. Tuyệt đối không bịa số.';
  }

  // Lịch sử hội thoại (đa lượt, như ChatGPT) — gửi kèm mỗi lần gọi LLM
  var chatHist = []; // [{role:'user'|'assistant', content:string}]
  function pushHist(role, content) {
    var txt = String(content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!txt) return;
    chatHist.push({ role: role, content: txt.slice(0, 2500) });
    if (chatHist.length > 12) chatHist = chatHist.slice(-12);
  }
  function histMessages(question) {
    // đảm bảo xen kẽ user/assistant (Anthropic yêu cầu), gộp lượt trùng vai
    var msgs = [];
    chatHist.concat([{ role: 'user', content: question }]).forEach(function (m) {
      if (msgs.length && msgs[msgs.length - 1].role === m.role) msgs[msgs.length - 1].content += '\n' + m.content;
      else msgs.push({ role: m.role, content: m.content });
    });
    if (msgs.length && msgs[0].role !== 'user') msgs.shift();
    return msgs;
  }
  function friendlyLLMError(j, status) {
    var raw = (j && j.error && (j.error.message || j.error.type)) || '';
    if (status === 401 || /invalid[_ ]api[_ ]key|authentication/i.test(raw))
      return 'API key không hợp lệ. Với OpenAI: key phải tạo tại platform.openai.com (dạng sk-...), khác với tài khoản ChatGPT/ChatGPT Go.';
    if (status === 404 || /model.*(not exist|not found)|does not exist/i.test(raw))
      return 'Tên model không tồn tại. Điền model API thật, vd: gpt-4o-mini (OpenAI) hoặc claude-3-5-haiku-latest (Anthropic). "ChatGPT Go" là tên gói thuê bao, không phải model.';
    if (status === 429 || /quota|billing|insufficient/i.test(raw))
      return 'Hết hạn mức/chưa nạp credit API. Kiểm tra billing tại platform.openai.com.';
    return raw || 'LLM không trả lời.';
  }

  function callLLM(question, cb) {
    var snap;
    try { snap = JSON.stringify(buildSnapshot()); } catch (e) { snap = '{}'; }
    var sys = systemPrompt() + '\n\nDỮ LIỆU:\n' + snap;
    var msgs = histMessages(question);
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
        body: JSON.stringify({ model: model, max_tokens: 1500, system: sys, messages: msgs })
      }).then(function (r) { return r.json().then(function (j) { return { j: j, s: r.status }; }); }).then(function (o) {
        if (o.j && o.j.content && o.j.content[0] && o.j.content[0].text) cb(null, o.j.content[0].text);
        else cb(new Error(friendlyLLMError(o.j, o.s)));
      }).catch(function (e) { cb(e); });
    } else {
      var base = settings.baseURL || 'https://api.openai.com/v1';
      var m2 = settings.model || 'gpt-4o-mini';
      fetch(base.replace(/\/$/, '') + '/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Authorization': 'Bearer ' + settings.apiKey },
        body: JSON.stringify({
          model: m2, temperature: 0.3,
          messages: [{ role: 'system', content: sys }].concat(msgs)
        })
      }).then(function (r) { return r.json().then(function (j) { return { j: j, s: r.status }; }); }).then(function (o) {
        if (o.j && o.j.choices && o.j.choices[0] && o.j.choices[0].message) cb(null, o.j.choices[0].message.content);
        else cb(new Error(friendlyLLMError(o.j, o.s)));
      }).catch(function (e) { cb(e); });
    }
  }

  function llmReady() { return settings.provider !== 'local' && settings.apiKey; }

  // ==================================================================== VIEW
  function injectCSS() {
    var css =
    '.ga-fab{position:fixed;right:22px;bottom:22px;width:56px;height:56px;border-radius:50%;' +
    'background:linear-gradient(135deg,#2fd4c4,#0e8a80);color:#fff;border:none;cursor:pointer;' +
    'box-shadow:0 8px 24px rgba(14,138,128,.4);font-size:24px;z-index:9998;display:flex;align-items:center;justify-content:center;transition:transform .15s}' +
    '.ga-fab:hover{transform:scale(1.08)}' +
    '.ga-panel{position:fixed;right:22px;bottom:90px;width:390px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);' +
    'background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.18);z-index:9999;display:none;flex-direction:column;overflow:hidden;font-family:inherit}' +
    '.ga-panel.open{display:flex}' +
    '.ga-head{background:linear-gradient(135deg,#2fd4c4,#0e8a80);color:#fff;padding:12px 14px;display:flex;align-items:center;gap:8px}' +
    '.ga-head b{font-size:14px;flex:1}' +
    '.ga-head .ga-sub{font-size:11px;opacity:.9;font-weight:400}' +
    '.ga-ic{background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:14px}' +
    '.ga-ic:hover{background:rgba(255,255,255,.35)}' +
    '.ga-body{flex:1;overflow-y:auto;padding:14px;background:#f8fafc}' +
    '.ga-msg{margin-bottom:12px;display:flex}' +
    '.ga-msg.u{justify-content:flex-end}' +
    '.ga-bub{max-width:88%;padding:9px 12px;border-radius:12px;font-size:13px;line-height:1.5;word-wrap:break-word}' +
    '.ga-msg.u .ga-bub{background:#0e8a80;color:#fff;border-bottom-right-radius:3px}' +
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
    '.ga-kpi{background:#ecfdfb;border:1px solid #99e6dd;border-radius:10px;padding:10px 12px;text-align:center;margin:4px 0}' +
    '.ga-kpi-v{font-size:20px;font-weight:800;color:#0e8a80}.ga-kpi-l{font-size:12px;color:#475569;font-weight:600}.ga-kpi-s{font-size:11px;color:#94a3b8;margin-top:2px}' +
    '.ga-note{background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;font-size:11.5px;padding:6px 9px;border-radius:8px;margin:6px 0}' +
    '.ga-hr{border:none;border-top:1px dashed #e5e7eb;margin:10px 0}' +
    '.ga-src{font-size:10px;color:#94a3b8;margin-top:4px;text-align:right}' +
    '.ga-foot{padding:10px;border-top:1px solid #e5e7eb;background:#fff;display:flex;gap:8px;align-items:flex-end}' +
    '.ga-in{flex:1;border:1px solid #cbd5e1;border-radius:10px;padding:9px 11px;font-size:13px;resize:none;font-family:inherit;max-height:90px;outline:none}' +
    '.ga-in:focus{border-color:#2fd4c4}' +
    '.ga-send{background:#0e8a80;border:none;color:#fff;border-radius:10px;width:40px;height:38px;cursor:pointer;font-size:16px}' +
    '.ga-send:disabled{opacity:.5;cursor:default}' +
    '.ga-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}' +
    '.ga-chip{background:#fff;border:1px solid #99e6dd;color:#0e7a70;font-size:11px;padding:4px 9px;border-radius:20px;cursor:pointer}' +
    '.ga-chip:hover{background:#ecfdfb}' +
    '.ga-set{padding:14px;overflow-y:auto;font-size:13px}' +
    '.ga-set label{display:block;font-weight:600;margin:10px 0 4px;color:#334155;font-size:12px}' +
    '.ga-set input,.ga-set select{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;font-family:inherit}' +
    '.ga-set .ga-row{display:flex;align-items:center;gap:8px;margin-top:10px}' +
    '.ga-set .ga-row input{width:auto}' +
    '.ga-btn{background:#0e8a80;color:#fff;border:none;padding:9px 14px;border-radius:8px;font-weight:700;cursor:pointer;margin-top:14px;font-size:13px}' +
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
    // Chips (gợi ý câu hỏi) — click ủy quyền, hoạt động cả với chips trong câu trả lời
    els.body.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains('ga-chip')) {
        els.input.value = t.textContent;
        onSend();
      }
    });
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
      var warn = '';
      if (settings.provider === 'openai' && settings.model && /\s|chatgpt/i.test(settings.model)) {
        warn = note('⚠️ Model "' + esc(settings.model) + '" có vẻ không phải tên model API. "ChatGPT Go/Plus" là gói thuê bao ứng dụng, không dùng cho API. ' +
          'Hãy điền model thật, vd: <b>gpt-4o-mini</b>. API key phải tạo tại <b>platform.openai.com</b> (dạng sk-...) và có credit.');
      }
      if (settings.provider !== 'local' && settings.apiKey && !warn) {
        warn = note('💡 Mẹo: bật "Luôn ưu tiên LLM" nếu muốn mọi câu đều do AI trả lời như ChatGPT; để tắt thì máy nội bộ trả trước, AI chỉ nhận câu khó.');
      }
      addMsg('a', note('✅ Đã lưu cài đặt. Bộ não hiện tại: <b>' + modeName() + '</b>.') + warn);
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
    var list = ['Phân tích tổng quan', 'Phân tích phạt nguội', 'Phân tích tăng cường', 'Xe sắp hết hạn đăng kiểm', 'Xe đang ở xưởng'];
    var wrap = document.createElement('div'); wrap.className = 'ga-chips';
    wrap.innerHTML = list.map(function (c) { return '<span class="ga-chip">' + esc(c) + '</span>'; }).join('');
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
    pushHist('user', q);
    var forceLLM = llmReady() && settings.preferLLM;
    var local = forceLLM ? { matched: false } : runLocal(q);

    if (local.matched) {
      var b = addMsg('a', local.answer);
      var s = document.createElement('div'); s.className = 'ga-src'; s.textContent = 'Nguồn: dữ liệu dashboard (máy nội bộ)';
      b.appendChild(s);
      pushHist('assistant', local.answer);
      return;
    }

    if (llmReady()) {
      var typing = addMsg('a', '<span class="ga-typing">Đang hỏi ' + esc(modeName()) + '…</span>');
      callLLM(q, function (err, text) {
        if (err) { typing.innerHTML = note('❌ ' + esc(err.message || String(err)) + '<br>Kiểm tra lại ở ⚙️ Cài đặt.'); return; }
        typing.innerHTML = mdToHtml(text);
        var s = document.createElement('div'); s.className = 'ga-src'; s.textContent = 'Nguồn: ' + modeName() + ' (dựa trên dữ liệu dashboard)';
        typing.appendChild(s);
        pushHist('assistant', text);
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
