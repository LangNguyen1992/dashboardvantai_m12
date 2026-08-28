/* =============================================================================
 * refresh-snapshot-ci.js — Bản chạy TỰ ĐỘNG trên GitHub Actions
 * -----------------------------------------------------------------------------
 * Khác bản chạy tay (refresh-snapshot.js): không cần mở trình duyệt, không cần
 * dán token — Actions tự có quyền ghi vào repo.
 * ĐIỀU KIỆN: Google Sheet phải bật chia sẻ "Bất kỳ ai có đường liên kết" (quyền Xem),
 * vì máy chủ GitHub truy cập ẩn danh, không đăng nhập được tài khoản GHN.
 * ========================================================================== */
const fs = require('fs');

const SHEET_ID = '12Pe7N5dByhBw2XF4pZOkEgYb7_F14NgQlryhdhUlGf8';
const OUT = 'data-snapshot.json';
const SHEETS = ['Thông tin xe', 'Lịch tải', 'Phạt nguội', 'Hiệu suất sử dụng xe',
                'Nhân sự', 'Tải tăng cường Lấy', 'Ontime xe tải', 'BTBD'];

function parseCSV(s) {
  const R = []; let f = '', row = [], q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); R.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f !== '' || row.length) { row.push(f); R.push(row); }
  return R;
}

(async () => {
  const sheets = {};
  const report = [];
  let ok = 0;

  // Thu lan luot 3 cach lay CSV: gviz -> export -> published-to-web
  function urlsFor(name) {
    const id = SHEET_ID, n = encodeURIComponent(name);
    return [
      ['gviz',   'https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=out:csv&headers=1&sheet=' + n],
      ['export', 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=csv&sheet=' + n],
      ['pub',    'https://docs.google.com/spreadsheets/d/e/' + id + '/pub?output=csv&sheet=' + n]
    ];
  }

  for (const name of SHEETS) {
    let done = false, lastErr = '';
    for (const [cach, url] of urlsFor(name)) {
      try {
        const res = await fetch(url, { redirect: 'follow' });
        const txt = await res.text();
        if (!res.ok) throw new Error('HTTP ' + res.status);
        if (/^\s*<!DOCTYPE|accounts\.google\.com|ServiceLogin/i.test(txt)) throw new Error('bi doi trang dang nhap');
        const rows = parseCSV(txt);
        if (rows.length < 2) throw new Error('rong hoac #REF!');
        sheets[name] = rows;
        ok++; done = true;
        report.push('OK   [' + cach + '] ' + name + ': ' + (rows.length - 1) + ' dong');
        break;
      } catch (e) {
        lastErr = '[' + cach + '] ' + e.message;
      }
    }
    if (!done) report.push('BO QUA ' + name + ': ' + lastErr);
  }

  console.log(report.join('\n'));

  if (ok === 0) {
    console.error('\nLOI: khong lay duoc tab nao. Kiem tra quyen chia se cua Google Sheet:');
    console.error('Sheet > Chia se > Quyen truy cap chung > "Bat ky ai co duong lien ket" (Nguoi xem).');
    process.exit(1);
  }

  // Tab "Lịch tải" đang lỗi #REF! trên Sheet -> chèn dòng tiêu đề rỗng để app không vỡ khi parse.
  if (!sheets['Lịch tải']) {
    sheets['Lịch tải'] = [['Tuyến', 'Tải trọng', 'ID', 'Tên kho', 'Loại hình', 'Tới điểm', 'Rời điểm', 'Loại tuyến']];
  }

  const payload = {
    generatedAt: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
    sourceSheetId: SHEET_ID,
    sheets
  };

  fs.writeFileSync(OUT, JSON.stringify(payload));
  console.log('\nDa ghi ' + OUT + ' luc ' + payload.generatedAt + ' (' + ok + '/' + SHEETS.length + ' tab).');
})();
