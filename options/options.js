/* Change Timezone — options page logic */
(function () {
  'use strict';
  var CTZ = window.CTZ;
  var t = function (k, s) { return CTZ.i18n.t(k, s); };

  // Native language names (always shown in their own language).
  var LANG_NAMES = {
    en: 'English', zh_CN: '简体中文', zh_TW: '繁體中文', ja: '日本語', ko: '한국어',
    es: 'Español', pt_BR: 'Português (Brasil)', fr: 'Français', de: 'Deutsch',
    ru: 'Русский', it: 'Italiano', tr: 'Türkçe', id: 'Bahasa Indonesia', vi: 'Tiếng Việt',
  };

  var els = {
    language: document.getElementById('language'),
    mode: document.getElementById('mode'),
    modeHint: document.getElementById('modeHint'),
    defaultTz: document.getElementById('defaultTz'),
    reloadOnApply: document.getElementById('reloadOnApply'),
    badge: document.getElementById('badge'),
    btnVerify: document.getElementById('btnVerify'),
    verifyResult: document.getElementById('verifyResult'),
    btnSave: document.getElementById('btnSave'),
    savedTip: document.getElementById('savedTip'),
    version: document.getElementById('version'),
    srcLink: document.getElementById('srcLink'),
  };

  var settings = {};
  var tzData = null;

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function modeHintText(mode) {
    if (mode === 'cdp') return t('modeCdpHint');
    if (mode === 'script') return t('modeScriptHint');
    return t('modeAutoHint');
  }

  function renderLanguages() {
    var html = '<option value="auto"' + (settings.language === 'auto' ? ' selected' : '') + '>' +
      escapeHtml(t('langAuto')) + '</option>';
    CTZ.i18n.supported.forEach(function (code) {
      html += '<option value="' + code + '"' + (settings.language === code ? ' selected' : '') + '>' +
        escapeHtml(LANG_NAMES[code] || code) + '</option>';
    });
    els.language.innerHTML = html;
  }

  function renderTzSelect() {
    var html = '<option value="system"' + (settings.defaultTimezone === 'system' ? ' selected' : '') + '>' +
      escapeHtml(t('optionSystem')) + '</option>';
    html += '<optgroup label="' + escapeHtml(t('groupPopular')) + '">';
    tzData.zones.filter(function (z) { return z.popular; }).forEach(function (z) {
      html += '<option value="' + escapeHtml(z.id) + '"' +
        (settings.defaultTimezone === z.id ? ' selected' : '') + '>' +
        escapeHtml(z.name + ' (' + z.id + ')') + '</option>';
    });
    html += '</optgroup>';
    var regions = {};
    tzData.zones.forEach(function (z) {
      if (z.popular) return;
      (regions[z.region] = regions[z.region] || []).push(z);
    });
    Object.keys(regions).sort().forEach(function (r) {
      html += '<optgroup label="' + escapeHtml(t('region' + r)) + '">';
      regions[r].forEach(function (z) {
        html += '<option value="' + escapeHtml(z.id) + '"' +
          (settings.defaultTimezone === z.id ? ' selected' : '') + '>' +
          escapeHtml(z.name + ' (' + z.id + ')') + '</option>';
      });
      html += '</optgroup>';
    });
    els.defaultTz.innerHTML = html;
  }

  function render() {
    renderLanguages();
    renderTzSelect();
    els.mode.value = settings.mode || 'auto';
    els.modeHint.textContent = modeHintText(els.mode.value);
    els.reloadOnApply.checked = !!settings.reloadOnApply;
    els.badge.checked = settings.badge !== false;
    els.version.textContent = 'v' + chrome.runtime.getManifest().version;
  }

  function doVerify() {
    els.verifyResult.classList.remove('hidden');
    els.verifyResult.className = 'verify';
    els.verifyResult.textContent = t('verifyRunning');
    CTZ.messaging.activeTab().then(function (tab) {
      var tabId = tab && tab.id != null ? tab.id : null;
      return CTZ.messaging.send({ type: 'ctz:verify', tabId: tabId });
    }).then(function (res) {
      var html = '<div class="head"></div>';
      if (!res || !res.ok) {
        html += escapeHtml((res && res.error) || t('errDebuggerAttach'));
        els.verifyResult.className = 'verify err';
      } else if (!res.observed) {
        html += escapeHtml(t('verifyNeedPage'));
        els.verifyResult.className = 'verify err';
      } else {
        var pass = !!res.pass;
        html += escapeHtml(pass ? t('verifyPass') : (res.detached ? t('verifyDetached') : t('verifyFail')));
        html += '<table>' +
          '<tr><td>' + escapeHtml(t('verifyObservedName')) + '</td><td>' + escapeHtml(res.observed.tz || '—') + '</td></tr>' +
          '<tr><td>' + escapeHtml(t('verifyObservedOffset')) + '</td><td>' + escapeHtml(CTZ.formatOffset(res.observed.offsetMinutes || 0)) + '</td></tr>' +
          '<tr><td>' + escapeHtml(t('verifyObservedTime')) + '</td><td>' + escapeHtml(res.observed.local || '—') + '</td></tr>' +
          '<tr><td>' + escapeHtml(t('labelExpected')) + '</td><td>' + escapeHtml(res.expected) + '</td></tr>' +
          '<tr><td>' + escapeHtml(t('verifyResult')) + '</td><td>' + (pass ? '✓' : '✗') + '</td></tr>' +
          '</table>';
        els.verifyResult.className = 'verify ' + (pass ? 'ok' : 'err');
      }
      els.verifyResult.innerHTML = html;
    }).catch(function (e) {
      els.verifyResult.className = 'verify err';
      els.verifyResult.textContent = String((e && e.message) || e);
    });
  }

  function doSave() {
    settings.language = els.language.value;
    settings.mode = els.mode.value;
    settings.defaultTimezone = els.defaultTz.value;
    settings.reloadOnApply = els.reloadOnApply.checked;
    settings.badge = els.badge.checked;
    CTZ.storage.set({ settings: settings }).then(function () {
      els.savedTip.classList.remove('hidden');
      setTimeout(function () { els.savedTip.classList.add('hidden'); }, 1600);
    });
  }

  els.mode.addEventListener('change', function () {
    els.modeHint.textContent = modeHintText(els.mode.value);
  });
  els.btnVerify.addEventListener('click', doVerify);
  els.btnSave.addEventListener('click', doSave);

  /* ---------------- init ---------------- */

  CTZ.storage.get('settings').then(function (d) {
    settings = d.settings || {};
    return CTZ.i18n.init(settings.language);
  }).then(function () {
    CTZ.i18n.apply(document);
    document.title = t('extName');
    return CTZ.loadTimezones();
  }).then(function (data) {
    tzData = data;
    render();
  }).catch(function (e) {
    document.body.textContent = String((e && e.message) || e);
  });
})();
