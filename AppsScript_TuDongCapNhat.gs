/**
 * ============================================================================
 * TU DONG CAP NHAT DASHBOARD M12  —  Google Apps Script
 * ----------------------------------------------------------------------------
 * VI SAO DUNG CACH NAY: chinh sach GHN khong cho chia se Sheet ra ngoai to chuc,
 * nen may chu GitHub khong doc duoc. Apps Script chay BEN TRONG tai khoan
 * langnv@ghn.vn -> doc Sheet binh thuong, roi day du lieu len GitHub.
 *
 * CAI DAT 1 LAN (khoang 3 phut):
 *   1. Mo Google Sheet "Dashboard Bao cao van hanh"
 *   2. Menu: Tien ich mo rong (Extensions) > Apps Script
 *   3. Xoa het code mau, dan TOAN BO file nay vao
 *   4. Sua dong GH_TOKEN o duoi thanh token GitHub cua ban
 *   5. Chon ham "caiDat" tren thanh cong cu > bam Chay (Run)
 *      -> Google hoi cap quyen: bam Review permissions > chon tai khoan
 *         > Advanced > Go to ... (unsafe) > Allow   (day la script cua chinh ban)
 *   6. Xong. Script tu chay MOI GIO, khong can lam gi them.
 *
 * KIEM TRA: chay ham "capNhatNgay" bat cu luc nao de cap nhat thu cong.
 * XEM LOG: menu Thuc thi (Executions) ben trai.
 * ==========================================================================*/

// ====================== CAU HINH ======================
var GH_TOKEN = 'DAN_TOKEN_GITHUB_VAO_DAY';   // vd: ghp_xxxxxxxxxxxx
var GH_OWNER = 'LangNguyen1992';
var GH_REPO  = 'dashboardvantai_m12';
var GH_PATH  = 'data-snapshot.json';
var SHEET_ID = '12Pe7N5dByhBw2XF4pZOkEgYb7_F14NgQlryhdhUlGf8';

var SHEETS = ['Thông tin xe', 'Lịch tải', 'Phạt nguội', 'Hiệu suất sử dụng xe',
              'Nhân sự', 'Tải tăng cường Lấy', 'Ontime xe tải', 'BTBD'];

var SO_GIO_MOI_LAN_CHAY = 1;   // chay moi 1 gio; doi thanh 2, 4, 6... neu muon thua hon

// ====================== CAI DAT TRIGGER ======================
function caiDat() {
  // Xoa trigger cu de khong bi trung
  var ts = ScriptApp.getProjectTriggers();
  for (var i = 0; i < ts.length; i++) {
    if (ts[i].getHandlerFunction() === 'capNhatNgay') ScriptApp.deleteTrigger(ts[i]);
  }
  ScriptApp.newTrigger('capNhatNgay').timeBased().everyHours(SO_GIO_MOI_LAN_CHAY).create();
  Logger.log('Da tao lich tu dong: chay moi ' + SO_GIO_MOI_LAN_CHAY + ' gio.');
  // Chay ngay 1 lan cho co du lieu moi
  capNhatNgay();
}

// ====================== HAM CHINH ======================
function capNhatNgay() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheets = {};
  var baoCao = [];
  var soTabOk = 0;

  for (var i = 0; i < SHEETS.length; i++) {
    var ten = SHEETS[i];
    try {
      var sh = ss.getSheetByName(ten);
      if (!sh) throw new Error('khong tim thay tab');
      var values = sh.getDataRange().getDisplayValues();   // lay dung nhu hien thi
      // Cat bo cac dong trong o cuoi
      while (values.length && values[values.length - 1].join('') === '') values.pop();
      if (values.length < 2) throw new Error('tab rong');
      sheets[ten] = values;
      soTabOk++;
      baoCao.push('OK   ' + ten + ': ' + (values.length - 1) + ' dong');
    } catch (e) {
      baoCao.push('BO QUA ' + ten + ': ' + e.message);
    }
  }

  if (soTabOk === 0) {
    Logger.log(baoCao.join('\n'));
    throw new Error('Khong doc duoc tab nao - kiem tra lai ten tab trong SHEETS.');
  }

  // Tab "Lich tai" dang loi #REF! -> chen dong tieu de rong de dashboard khong vo
  if (!sheets['Lịch tải']) {
    sheets['Lịch tải'] = [['Tuyến', 'Tải trọng', 'ID', 'Tên kho', 'Loại hình', 'Tới điểm', 'Rời điểm', 'Loại tuyến']];
  }

  var payload = {
    generatedAt: Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'HH:mm:ss dd/MM/yyyy'),
    sourceSheetId: SHEET_ID,
    sheets: sheets
  };

  dayLenGitHub(JSON.stringify(payload), payload.generatedAt);
  Logger.log(baoCao.join('\n') + '\n\nDA CAP NHAT LUC ' + payload.generatedAt);
}

// ====================== DAY LEN GITHUB ======================
function dayLenGitHub(noiDung, thoiDiem) {
  var api = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + GH_PATH;
  var headers = {
    Authorization: 'Bearer ' + GH_TOKEN,
    Accept: 'application/vnd.github+json'
  };

  // Lay sha cua file hien tai (bat buoc khi ghi de)
  var sha = null;
  try {
    var res = UrlFetchApp.fetch(api, { headers: headers, muteHttpExceptions: true });
    if (res.getResponseCode() === 200) sha = JSON.parse(res.getContentText()).sha;
  } catch (e) {}

  var body = {
    message: 'chore: tu dong cap nhat data-snapshot ' + thoiDiem,
    content: Utilities.base64Encode(noiDung, Utilities.Charset.UTF_8)
  };
  if (sha) body.sha = sha;

  var put = UrlFetchApp.fetch(api, {
    method: 'put',
    headers: headers,
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  var code = put.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new Error('Day len GitHub that bai (HTTP ' + code + '): ' + put.getContentText().slice(0, 300));
  }
  Logger.log('Da day len GitHub thanh cong.');
}

// ====================== TIEN ICH ======================
function xemLichDangChay() {
  var ts = ScriptApp.getProjectTriggers();
  if (!ts.length) { Logger.log('Chua co lich tu dong. Hay chay ham caiDat().'); return; }
  for (var i = 0; i < ts.length; i++) Logger.log('Lich: ' + ts[i].getHandlerFunction());
}

function huyLichTuDong() {
  var ts = ScriptApp.getProjectTriggers();
  for (var i = 0; i < ts.length; i++) ScriptApp.deleteTrigger(ts[i]);
  Logger.log('Da huy toan bo lich tu dong.');
}
