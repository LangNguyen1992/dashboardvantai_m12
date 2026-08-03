/* ============================================================================
 * GHN Ops Dashboard — Cổng đăng nhập (email @ghn.vn + mật khẩu chung)
 * ----------------------------------------------------------------------------
 * - Tên đăng nhập: email công ty dạng xxx@ghn.vn (bắt buộc đúng định dạng).
 * - Mật khẩu chung: chỉ lưu SHA-256(salt + mật khẩu) — không lộ trong code.
 * - Hiển thị tên người dùng (phần trước @) ở sidebar sau khi đăng nhập.
 * - Lịch sử đăng nhập:
 *     (1) Lưu cục bộ trên máy (localStorage, tối đa 300 dòng) — hỏi trợ lý
 *         "ai đã đăng nhập" hoặc gõ GHNLoginLog() trong Console.
 *     (2) Gửi về Google Form tập trung nếu LOG_FORM được cấu hình.
 * - Đăng xuất: bấm vào avatar ở góc dưới sidebar.
 * - Đổi mật khẩu: thay HASH = sha256('ghn-m12-dash' + mật_khẩu_mới).
 * ==========================================================================*/
(function () {
  'use strict';
  var SALT = 'ghn-m12-dash';
  var HASH = '2179ae3f3aadd86c0d478b898f5921d6336830e22c2c33519e9a1e93d2c311e3';
  var SS_KEY = 'ghn_dash_auth_v2';
  var LS_EMAIL = 'ghn_dash_last_email';
  var LS_LOG = 'ghn_dash_login_log';

  // Log tập trung qua Google Form "GHN Dashboard - Login Log"
  // Xem lịch sử: mở form -> tab Câu trả lời (có thể Liên kết với Trang tính)
  var LOG_FORM = {
    action: 'https://docs.google.com/forms/d/e/1FAIpQLSdQT-zB-t95QECtEBkM_mwWvkaoKHLj5yLY0OBtP_V_o8dNtA/formResponse',
    emailField: 'entry.1571758886',
    timeField: 'entry.82817262'
  };

  function userFromEmail(email) { return String(email || '').split('@')[0]; }

  function applyUser(email) {
    var tries = 0;
    (function tick() {
      var nameEl = document.querySelector('.sidebar-footer .user-name');
      var roleEl = document.querySelector('.sidebar-footer .user-role');
      var avaEl = document.querySelector('.sidebar-footer .avatar');
      if (!nameEl || !avaEl) { if (tries++ < 40) setTimeout(tick, 250); return; }
      var u = userFromEmail(email);
      nameEl.textContent = u;
      if (roleEl) roleEl.textContent = email + ' • M12 - KTC HCM';
      avaEl.textContent = u.slice(0, 2).toUpperCase();
      avaEl.title = 'Đăng xuất (' + email + ')';
      avaEl.style.cursor = 'pointer';
      avaEl.addEventListener('click', function () {
        if (confirm('Đăng xuất khỏi dashboard?')) {
          try { sessionStorage.removeItem(SS_KEY); } catch (e) {}
          location.reload();
        }
      });
    })();
  }

  function appendLog(email) {
    try {
      var log = JSON.parse(localStorage.getItem(LS_LOG) || '[]');
      log.push({ e: email, t: new Date().toISOString() });
      if (log.length > 300) log = log.slice(-300);
      localStorage.setItem(LS_LOG, JSON.stringify(log));
    } catch (e) {}
  }
  function postCentral(email) {
    if (!LOG_FORM.action || !LOG_FORM.emailField) return;
    try {
      var body = LOG_FORM.emailField + '=' + encodeURIComponent(email);
      if (LOG_FORM.timeField) body += '&' + LOG_FORM.timeField + '=' + encodeURIComponent(new Date().toLocaleString('vi-VN'));
      fetch(LOG_FORM.action, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      }).catch(function () {});
    } catch (e) {}
  }

  // Tra cứu lịch sử trên máy này: GHNLoginLog() trong Console
  window.GHNLoginLog = function () {
    try { return JSON.parse(localStorage.getItem(LS_LOG) || '[]'); } catch (e) { return []; }
  };

  // Đã đăng nhập trong phiên?
  try {
    var ss = JSON.parse(sessionStorage.getItem(SS_KEY) || 'null');
    if (ss && ss.h === HASH && ss.e) { applyUser(ss.e); return; }
  } catch (e) {}

  var css =
    '#ghnGate{position:fixed;inset:0;z-index:2147483647;background:linear-gradient(160deg,#0f1517 0%,#12211f 100%);' +
    'display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif}' +
    '#ghnGate::before{content:"";position:absolute;inset:0;opacity:.07;background-image:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'70\' height=\'70\' viewBox=\'0 0 70 70\'><g fill=\'none\' stroke=\'%2317a398\' stroke-width=\'7\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'M10 12 L28 32 L10 52\'/><path d=\'M38 12 L56 32 L38 52\'/></g></svg>");background-size:70px 70px}' +
    '.ghn-card{position:relative;width:350px;max-width:calc(100vw - 40px);background:#15211e;border:1px solid rgba(23,163,152,.35);' +
    'border-radius:16px;padding:28px 26px;box-shadow:0 24px 70px rgba(0,0,0,.55);text-align:center}' +
    '.ghn-card .lg{width:54px;height:54px;margin:0 auto 12px}' +
    '.ghn-card h1{font-size:17px;color:#fff;font-weight:800;margin:0 0 2px}' +
    '.ghn-card .sub{font-size:11px;color:#2fd4c4;letter-spacing:1.5px;font-weight:700;margin-bottom:18px}' +
    '.ghn-card label{display:block;text-align:left;font-size:11px;color:#8fa8a3;font-weight:600;margin:12px 0 5px}' +
    '.ghn-card input{width:100%;box-sizing:border-box;background:#0e1513;border:1px solid rgba(255,255,255,.14);color:#eef4f2;' +
    'border-radius:9px;padding:11px 12px;font-size:14px;outline:none;text-align:center}' +
    '.ghn-card input#ghnPass{letter-spacing:2px}' +
    '.ghn-card input:focus{border-color:#17a398;box-shadow:0 0 0 3px rgba(23,163,152,.18)}' +
    '.ghn-card button{width:100%;margin-top:16px;background:linear-gradient(135deg,#2fd4c4,#0e8a80);color:#04211d;border:none;' +
    'border-radius:9px;padding:11px;font-size:14px;font-weight:800;cursor:pointer}' +
    '.ghn-card button:hover{filter:brightness(1.08)}' +
    '.ghn-err{color:#ff8f86;font-size:12px;margin-top:10px;min-height:16px;font-weight:600}' +
    '.ghn-foot{margin-top:14px;font-size:10px;color:#5d716c;letter-spacing:1px}' +
    '@keyframes ghnShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}' +
    '.ghn-card.shake{animation:ghnShake .4s}';

  function build() {
    var st = document.createElement('style'); st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
    var ov = document.createElement('div'); ov.id = 'ghnGate';
    var lastEmail = '';
    try { lastEmail = localStorage.getItem(LS_EMAIL) || ''; } catch (e) {}
    ov.innerHTML =
      '<div class="ghn-card" id="ghnCard">' +
        '<svg class="lg" viewBox="0 0 48 48"><rect x="1" y="1" width="46" height="46" rx="11" fill="#0f1517"/><rect x="1" y="1" width="46" height="46" rx="11" fill="none" stroke="#17a398" stroke-width="2"/><g fill="none" stroke="#2fd4c4" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15 L21 24 L12 33"/><path d="M24 15 L33 24 L24 33"/></g></svg>' +
        '<h1>GHN Ops Dashboard</h1>' +
        '<div class="sub">LINEHAUL M12 — KTC HCM</div>' +
        '<label>Email công ty (@ghn.vn)</label>' +
        '<input type="email" id="ghnEmail" autocomplete="username" placeholder="langnv@ghn.vn" value="' + lastEmail.replace(/"/g, '') + '">' +
        '<label>Mật khẩu truy cập</label>' +
        '<input type="password" id="ghnPass" autocomplete="current-password" placeholder="••••••••••">' +
        '<button id="ghnGo">Đăng nhập</button>' +
        '<div class="ghn-err" id="ghnErr"></div>' +
        '<div class="ghn-foot">YOUR LOADS. OUR ROADS.</div>' +
      '</div>';
    document.body.appendChild(ov);
    var emailInp = document.getElementById('ghnEmail');
    var passInp = document.getElementById('ghnPass');
    setTimeout(function () { (lastEmail ? passInp : emailInp).focus(); }, 100);

    function fail(msg) {
      var card = document.getElementById('ghnCard');
      document.getElementById('ghnErr').textContent = msg;
      card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
    }
    function sha256Hex(str) {
      var data = new TextEncoder().encode(str);
      return crypto.subtle.digest('SHA-256', data).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return ('0' + b.toString(16)).slice(-2);
        }).join('');
      });
    }
    function tryLogin() {
      var email = (emailInp.value || '').trim().toLowerCase();
      var v = passInp.value;
      if (!/^[a-z0-9][a-z0-9._-]*@ghn\.vn$/.test(email)) {
        fail('Email không hợp lệ — dùng email công ty dạng langnv@ghn.vn');
        emailInp.focus(); return;
      }
      if (!v) { fail('Nhập mật khẩu.'); passInp.focus(); return; }
      sha256Hex(SALT + v).then(function (h) {
        if (h === HASH) {
          try {
            sessionStorage.setItem(SS_KEY, JSON.stringify({ h: HASH, e: email }));
            localStorage.setItem(LS_EMAIL, email);
          } catch (e) {}
          appendLog(email);
          postCentral(email);
          ov.remove();
          applyUser(email);
        } else {
          fail('Sai mật khẩu, thử lại.');
          passInp.value = ''; passInp.focus();
        }
      }).catch(function () {
        fail('Trình duyệt không hỗ trợ, hãy mở bằng Chrome/Edge qua HTTPS.');
      });
    }
    document.getElementById('ghnGo').addEventListener('click', tryLogin);
    passInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryLogin(); });
    emailInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') passInp.focus(); });
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
