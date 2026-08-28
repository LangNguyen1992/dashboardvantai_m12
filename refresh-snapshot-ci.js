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

  for (const name of SHEETS) {
    const url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID +
                '/gviz/tq?tqx=out:csv&headers=1&sheet=' + encodeURIComponent(name);
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const txt = await res.text();
      if (/^\s*<!DOCTYPE|accounts\.google\.com/i.test(txt)) throw new Error('bi doi dang nhap (Sheet chua public)');
      const rows = parseCSV(txt);
      if (rows.length < 2) throw new Error('rong hoac #REF!');
      sheets[name] = rows;
      ok++;
      report.push('OK   ' + name + ': ' + (rows.length - 1) + ' dong');
    } catch (e) {
      report.push('BO QUA ' + name + ': ' + e.message);
    }
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
