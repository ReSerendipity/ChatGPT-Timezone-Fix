/*
 * Change Timezone — isolated-world content controller.
 * Responsibilities:
 *   1. Learn the tab's timezone state from the background (ctz:hello) and
 *      mirror it to (a) window.name / sessionStorage for synchronous reads
 *      by the MAIN-world spoofer across navigations, (b) live window
 *      messages so the MAIN world applies config without a reload.
 *   2. Relay verification requests: popup/background -> MAIN world observed
 *      values (works for both CDP and page-script modes).
 *   3. Render the optional floating verification badge on the page.
 */
(function () {
  'use strict';
  if (!window.CTZ || !window.CTZ.hasExtensionApi()) return;
  if (window.__CTZ_CTRL__) return;
  window.__CTZ_CTRL__ = true;

  var CTZ = window.CTZ;
  var CFG_KEY = '__ctz_cfg__';
  var NAME_PREFIX = 'CTZ:';

  var tabId = null;
  var settings = {};
  var currentTz = null;
  var badgeHost = null;
  var badgeTimer = null;

  CTZ.i18n.init('auto').then(function () {
    return chrome.runtime.sendMessage({ type: 'ctz:hello' }).catch(function () { return null; });
  }).then(function (hello) {
    if (!hello) return;
    tabId = hello.tabId;
    settings = hello.settings || {};
    pushConfig(hello.tab || null);
  });

  CTZ.storage.onChange(function (changes) {
    if (changes.settings) settings = Object.assign({}, settings, changes.settings.newValue || {});
    if (changes.tabs && tabId != null) {
      pushConfig((changes.tabs.newValue || {})[tabId] || null);
    }
  });

  function writeSyncChannels(tz) {
    if (window.top !== window) return;
    try {
      if (tz) {
        var payload = JSON.stringify({ timezone: tz, ts: Date.now() });
        window.name = NAME_PREFIX + payload;
        window.sessionStorage.setItem(CFG_KEY, payload);
      } else {
        window.name = '';
        window.sessionStorage.removeItem(CFG_KEY);
      }
    } catch (e) { /* private mode etc. */ }
  }

  function pushConfig(tabState) {
    var tz = tabState && tabState.timezone ? tabState.timezone : null;
    if (tz === currentTz && badgeHost === (tz ? true : false)) return;
    currentTz = tz;
    writeSyncChannels(tz);
    window.postMessage({ source: 'ctz-controller', type: 'ctz-config', timezone: tz }, '*');
    renderBadge(tz);
  }

  /* ---------------- verify relay ---------------- */

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || msg.type !== 'ctz:observe') return;
    var requestId = Math.random().toString(36).slice(2);
    var done = false;
    var timer = setTimeout(function () { finish(null); }, 2000);
    function onMessage(e) {
      if (e.source !== window) return;
      var d = e.data;
      if (d && d.source === 'ctz-main' && d.type === 'ctz-verify-response' && d.requestId === requestId) {
        finish({
          tz: d.tz,
          offsetMinutes: d.offsetMinutes,
          local: d.local,
        });
      }
    }
    function finish(val) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      sendResponse(val);
    }
    window.addEventListener('message', onMessage);
    window.postMessage({ source: 'ctz-controller', type: 'ctz-verify-request', requestId: requestId }, '*');
    return true; // async sendResponse
  });

  /* ---------------- floating badge ---------------- */

  function renderBadge(tz) {
    var want = !!tz && settings.badge !== false;
    if (!want) { removeBadge(); return; }
    if (!badgeHost) buildBadge();
    badgeHost.classList.add('ctz-show');
    pollBadge();
  }

  function removeBadge() {
    if (badgeTimer) { clearInterval(badgeTimer); badgeTimer = null; }
    if (badgeHost && badgeHost.parentNode) badgeHost.parentNode.removeChild(badgeHost);
    badgeHost = null;
  }

  function buildBadge() {
    var host = document.createElement('div');
    host.id = 'ctz-badge-host';
    host.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;';
    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<style>' +
      '.card{font:12px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#fff;color:#111827;' +
      'border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,.18);padding:10px 12px;min-width:210px;}' +
      '.t{font-weight:600;margin-bottom:6px;display:flex;justify-content:space-between;gap:8px;align-items:center}' +
      '.x{cursor:pointer;border:none;background:none;color:#6b7280;font-size:14px;padding:0 2px;line-height:1}' +
      '.row{display:flex;justify-content:space-between;gap:10px;color:#374151}' +
      '.chip{display:inline-block;padding:1px 8px;border-radius:999px;font-weight:600;margin-top:6px}' +
      '.ok{background:#dcfce7;color:#166534}.no{background:#fee2e2;color:#991b1b}' +
      '</style>' +
      '<div class="card" part="card">' +
      '<div class="t"><span class="title"></span><button class="x" title="">×</button></div>' +
      '<div class="row"><span class="exp-k"></span><span class="exp-v"></span></div>' +
      '<div class="row"><span class="obs-k"></span><span class="obs-v"></span></div>' +
      '<div><span class="chip"></span></div>' +
      '</div>';
    var t = CTZ.i18n.t.bind(CTZ.i18n);
    root.querySelector('.title').textContent = t('badgeTitle');
    root.querySelector('.x').title = t('badgeClose');
    root.querySelector('.x').addEventListener('click', removeBadge);
    root.querySelector('.exp-k').textContent = t('badgeExpected') + ':';
    root.querySelector('.obs-k').textContent = t('labelObserved') + ':';
    (document.body || document.documentElement).appendChild(host);
    badgeHost = host;
  }

  function pollBadge() {
    if (badgeTimer) clearInterval(badgeTimer);
    var tick = function () {
      if (!badgeHost || !currentTz) return;
      var root = badgeHost.shadowRoot;
      var t = CTZ.i18n.t.bind(CTZ.i18n);
      var sysTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      var ok = sysTz === currentTz;
      root.querySelector('.exp-v').textContent =
        currentTz + ' · ' + CTZ.formatOffset(CTZ.zoneOffsetMinutes(currentTz));
      root.querySelector('.obs-v').textContent =
        sysTz + ' · ' + CTZ.formatOffset(-new Date().getTimezoneOffset());
      var chip = root.querySelector('.chip');
      chip.textContent = ok ? '✓ ' + t('badgeOk') : '✗ ' + t('badgeNo');
      chip.className = 'chip ' + (ok ? 'ok' : 'no');
    };
    tick();
    badgeTimer = setInterval(tick, 1500);
  }
})();
