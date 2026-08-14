/* =============================================================================
 * refresh-snapshot.js  —  Lam moi data-snapshot.json cho dashboard M12
 * -----------------------------------------------------------------------------
 * VI SAO CAN: endpoint gviz cua Google Sheet tra 401 cho truy cap an danh, nen
 * dashboard chay tren github.io KHONG fetch truc tiep Sheet duoc (CORS/CSP).
 * Script nay chay TRONG TAB docs.google.com (cung origin, dung phien dang nhap
 * GHN san co) -> fetch duoc toan bo tab -> day thang len GitHub qua REST API.
 *
 * CACH DUNG: mo https://docs.google.com/spreadsheets/d/<ID>/edit, F12 > Console,
 * dan toan bo file nay, sua GH_TOKEN roi Enter.
 * ========================================================================== */
(async () => {
  const SHEET_ID = '12Pe7N5dByhBw2XF4pZOkEgYb7_F14NgQlryhdhUlGf8';
  const GH_OWNER = 'cdtnguyenlang';
  const GH_REPO  = 'dashboardvantai_m12';
  const GH_PATH  = 'data-snapshot.json';
  const GH_TOKEN = 'PASTE_FINE_GRAINED_PAT_HERE';

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

  const sheets = {}; const report = [];
  for (const name of SHEETS) {
    const url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:csv&headers=1&sheet=' + encodeURIComponent(name);
    try {
      const txt = await fetch(url, { credentials: 'include' }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });
      const rows = parseCSV(txt);
      if (rows.length < 2) throw new Error('rong hoac #REF!');
      sheets[name] = rows;
      report.push(name + ': ' + (rows.length - 1) + ' dong');
    } catch (e) {
      report.push(name + ': BO QUA (' + e.message + ')');
    }
  }

  const payload = {
    generatedAt: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
    sourceSheetId: SHEET_ID,
    sheets
  };
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));

  const api = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + GH_PATH;
  const hdr = { Authorization: 'Bearer ' + GH_TOKEN, Accept: 'application/vnd.github+json' };
  let sha = null;
  try { const cur = await fetch(api, { headers: hdr }); if (cur.ok) sha = (await cur.json()).sha; } catch (e) {}

  const put = await fetch(api, {
    method: 'PUT', headers: Object.assign({}, hdr, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message: 'chore: refresh data-snapshot ' + payload.generatedAt, content, sha })
  });

  console.log(report.join('\n'));
  console.log(put.ok ? 'DA DAY LEN GITHUB THANH CONG' : 'DAY LEN THAT BAI: ' + put.status + ' ' + (await put.text()).slice(0, 300));
})();
