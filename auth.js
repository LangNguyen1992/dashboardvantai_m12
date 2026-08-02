/* ============================================================================
 * GHN Ops Dashboard — Cổng mật khẩu (client-side gate)
 * ----------------------------------------------------------------------------
 * - Mật khẩu KHÔNG lưu dạng chữ trong code, chỉ lưu SHA-256(salt + mật khẩu).
 * - Ghi nhớ THEO PHIÊN (sessionStorage): đóng trình duyệt là phải nhập lại.
 * - Đổi mật khẩu: tính sha256('ghn-m12-dash' + mật_khẩu_mới) rồi thay HASH.
 * - Lưu ý: đây là lớp chặn phía trình duyệt cho trang tĩnh (GitHub Pages),
 *   đủ để hạn chế truy cập thông thường, không phải bảo mật tuyệt đối.
 * ==========================================================================*/
(function () {
  'use strict';
  var SALT = 'ghn-m12-dash';
  var HASH = '2179ae3f3aadd86c0d478b898f5921d6336830e22c2c33519e9a1e93d2c311e3';
  var SS_KEY = 'ghn_dash_auth_v1';

  try { if (sessionStorage.getItem(SS_KEY) === HASH) return; } catch (e) {}

  // ---- Overlay đăng nhập (che toàn trang bằng nền đặc) ----
  var css =
    '#ghnGate{position:fixed;inset:0;z-index:2147483647;background:linear-gradient(160deg,#0f1517 0%,#12211f 100%);' +
    'display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif}' +
    '#ghnGate::before{content:"";position:absolute;inset:0;opacity:.07;background-image:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'70\' height=\'70\' viewBox=\'0 0 70 70\'><g fill=\'none\' stroke=\'%2317a398\' stroke-width=\'7\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'M10 12 L28 32 L10 52\'/><path d=\'M38 12 L56 32 L38 52\'/></g></svg>");background-size:70px 70px}' +
    '.ghn-card{position:relative;width:340px;max-width:calc(100vw - 40px);background:#15211e;border:1px solid rgba(23,163,152,.35);' +
    'border-radius:16px;padding:30px 26px;box-shadow:0 24px 70px rgba(0,0,0,.55);text-align:center}' +
    '.ghn-card .lg{width:54px;height:54px;margin:0 auto 12px}' +
    '.ghn-card h1{font-size:17px;color:#fff;font-weight:800;margin:0 0 2px}' +
    '.ghn-card .sub{font-size:11px;color:#2fd4c4;letter-spacing:1.5px;font-weight:700;margin-bottom:20px}' +
    '.ghn-card label{display:block;text-align:left;font-size:11px;color:#8fa8a3;font-weight:600;margin-bottom:6px}' +
    '.ghn-card input{width:100%;box-sizing:border-box;background:#0e1513;border:1px solid rgba(255,255,255,.14);color:#eef4f2;' +
    'border-radius:9px;padding:11px 12px;font-size:14px;outline:none;letter-spacing:2px;text-align:center}' +
    '.ghn-card input:focus{border-color:#17a398;box-shadow:0 0 0 3px rgba(23,163,152,.18)}' +
    '.ghn-card button{width:100%;margin-top:14px;background:linear-gradient(135deg,#2fd4c4,#0e8a80);color:#04211d;border:none;' +
    'border-radius:9px;padding:11px;font-size:14px;font-weight:800;cursor:pointer}' +
    '.ghn-card button:hover{filter:brightness(1.08)}' +
    '.ghn-err{color:#ff8f86;font-size:12px;margin-top:10px;min-height:16px;font-weight:600}' +
    '.ghn-foot{margin-top:16px;font-size:10px;color:#5d716c;letter-spacing:1px}' +
    '@keyframes ghnShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}' +
    '.ghn-card.shake{animation:ghnShake .4s}';

  function build() {
    var st = document.createElement('style'); st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
    var ov = document.createElement('div'); ov.id = 'ghnGate';
    ov.innerHTML =
      '<div class="ghn-card" id="ghnCard">' +
        '<svg class="lg" viewBox="0 0 48 48"><rect x="1" y="1" width="46" height="46" rx="11" fill="#0f1517"/><rect x="1" y="1" width="46" height="46" rx="11" fill="none" stroke="#17a398" stroke-width="2"/><g fill="none" stroke="#2fd4c4" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15 L21 24 L12 33"/><path d="M24 15 L33 24 L24 33"/></g></svg>' +
        '<h1>GHN Ops Dashboard</h1>' +
        '<div class="sub">LINEHAUL M12 — KTC HCM</div>' +
        '<label>Mật khẩu truy cập</label>' +
        '<input type="password" id="ghnPass" autocomplete="current-password" placeholder="••••••••••">' +
        '<button id="ghnGo">Đăng nhập</button>' +
        '<div class="ghn-err" id="ghnErr"></div>' +
        '<div class="ghn-foot">YOUR LOADS. OUR ROADS.</div>' +
      '</div>';
    document.body.appendChild(ov);
    var inp = document.getElementById('ghnPass');
    setTimeout(function () { inp.focus(); }, 100);

    function sha256Hex(str) {
      var data = new TextEncoder().encode(str);
      return crypto.subtle.digest('SHA-256', data).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return ('0' + b.toString(16)).slice(-2);
        }).join('');
      });
    }
    function tryLogin() {
      var v = inp.value;
      if (!v) return;
      sha256Hex(SALT + v).then(function (h) {
        if (h === HASH) {
          try { sessionStorage.setItem(SS_KEY, HASH); } catch (e) {}
          ov.remove();
        } else {
          var card = document.getElementById('ghnCard');
          document.getElementById('ghnErr').textContent = 'Sai mật khẩu, thử lại.';
          inp.value = ''; inp.focus();
          card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
        }
      }).catch(function () {
        document.getElementById('ghnErr').textContent = 'Trình duyệt không hỗ trợ, hãy mở bằng Chrome/Edge qua HTTPS.';
      });
    }
    document.getElementById('ghnGo').addEventListener('click', tryLogin);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryLogin(); });
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
