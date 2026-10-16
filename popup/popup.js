/* Change Timezone — popup logic */
(function () {
  'use strict';
  var CTZ = window.CTZ;
  var t = function (k, s) { return CTZ.i18n.t(k, s); };

  var els = {
    tabStatus: document.getElementById('tabStatus'),
    mode: document.getElementById('mode'),
    modeHint: document.getElementById('modeHint'),
    search: document.getElementById('search'),
    list: document.getElementById('list'),
    preview: document.getElementById('previewTime'),
    favChips: document.getElementById('favChips'),
    favToggle: document.getElementById('favToggle'),
    btnApply: document.getElementById('btnApply'),
    btnReset: document.getElementById('btnReset'),
    btnVerify: document.getElementById('btnVerify'),
    btnRandom: document.getElementById('btnRandom'),
    btnOptions: document.getElementById('btnOptions'),
    verifyBox: document.getElementById('verifyBox'),
    ver: document.getElementById('ver'),
    notice: document.getElementById('pageNotice'),
    introTip: document.getElementById('introTip'),
  };

  var REGION_ORDER = ['Africa', 'America', 'Antarctica', 'Asia', 'Atlantic', 'Australia', 'Europe', 'Indian', 'Pacific', 'Etc'];

  var state = { tabId: null, tabUrl: '', settings: {}, tab: null, favorites: [] };
  var tzData = null;
  var selected = 'system';
  var previewTimer = null;

  /* ---------------- helpers ---------------- */

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function isRestricted(url) {
    if (!url) return false;
    return /^(chrome|edge|about|chrome-extension|moz-extension|devtools|view-source):/i.test(url);
  }

  function modeHintText(mode) {
    if (mode === 'cdp') return t('modeCdpHint');
    if (mode === 'script') return t('modeScriptHint');
    return t('modeAutoHint');
  }

  function showNotice(msg) {
    els.notice.textContent = msg;
    els.notice.classList.remove('hidden');
  }

  function showIntroTip() {
    CTZ.storage.get('introSeen').then(function (d) {
      if (d.introSeen) return;
      els.introTip.textContent = t('introTip');
      els.introTip.classList.remove('hidden');
    }).catch(function () { /* storage unavailable — skip tip */ });
  }

  function setBusy(busy) {
    els.btnApply.disabled = busy;
    els.btnVerify.disabled = busy;
    els.btnReset.disabled = busy;
    els.btnRandom.disabled = busy;
  }

  /* ---------------- rendering ---------------- */

  function renderStatus() {
    var tz = state.tab && state.tab.timezone;
    if (tz) {
      els.tabStatus.textContent = t('statusApplied', [tz + ' · ' + CTZ.formatOffset(CTZ.zoneOffsetMinutes(tz))]);
    } else {
      els.tabStatus.textContent = t('statusNone');
    }
  }

  function zoneLabel(z) {
    return z.name + ' — ' + z.id;
  }

  function buildList() {
    var q = els.search.value.trim().toLowerCase();
    var html = '';

    html += item('system', t('optionSystem'), CTZ.formatOffset(-new Date().getTimezoneOffset()), selected === 'system', 'sys');

    if (!q) {
      var pop = tzData.zones.filter(function (z) { return z.popular; });
      html += '<div class="gh">' + escapeHtml(t('groupPopular')) + '</div>';
      pop.forEach(function (z) { html += zoneItem(z, q); });
    }
    var byRegion = {};
    tzData.zones.forEach(function (z) {
      if (q && z.name.toLowerCase().indexOf(q) === -1 && z.id.toLowerCase().indexOf(q) === -1) return;
      (byRegion[z.region] = byRegion[z.region] || []).push(z);
    });
    REGION_ORDER.forEach(function (r) {
      var arr = byRegion[r];
      if (!arr || !arr.length) return;
      html += '<div class="gh">' + escapeHtml(t('region' + r)) + '</div>';
      arr.forEach(function (z) { html += zoneItem(z, q); });
    });
    if (!byRegion || Object.keys(byRegion).length === 0) {
      html += '<div class="gh">' + escapeHtml(t('groupAll')) + '</div>';
    }
    els.list.innerHTML = html;
  }

  function zoneItem(z, q) {
    var label = zoneLabel(z);
    var matched = !!q;
    var off = CTZ.formatOffset(CTZ.zoneOffsetMinutes(z.id));
    return item(z.id, label, off, selected === z.id, '', matched);
  }

  function item(tz, label, off, isSel, cls, dimmed) {
    return '<button type="button" class="item ' + (cls || '') + (isSel ? ' sel' : '') + '"' +
      ' role="option" aria-selected="' + (isSel ? 'true' : 'false') + '"' +
      ' data-tz="' + escapeHtml(tz) + '"' + (dimmed ? ' style="opacity:.45"' : '') + '>' +
      '<span class="nm">' + escapeHtml(label) + '</span>' +
      '<span class="off">' + escapeHtml(off) + '</span>' +
      '</button>';
  }

  function renderFav() {
    if (!state.favorites.length) { els.favChips.innerHTML = ''; return; }
    els.favChips.innerHTML = state.favorites.map(function (tz) {
      return '<button type="button" class="chip" data-tz="' + escapeHtml(tz) + '"' +
        (tz === selected ? ' style="border-color:var(--primary);color:var(--primary);font-weight:600"' : '') +
        '>' + escapeHtml(tz) + '</button>';
    }).join('');
    var star = state.favorites.indexOf(selected) === -1 && selected !== 'system';
    els.favToggle.textContent = star ? '☆' : '★';
    els.favToggle.title = t(star ? 'favAdd' : 'favRemove');
  }

  function renderPreview() {
    var tz = (selected && selected !== 'system') ? selected : CTZ.systemTimezone();
    els.preview.textContent = CTZ.nowIn(tz);
  }

  function renderAll() {
    els.mode.value = state.settings.mode || 'auto';
    els.modeHint.textContent = modeHintText(els.mode.value);
    if (isRestricted(state.tabUrl)) showNotice(t('verifyNeedPage'));
    buildList();
    renderFav();
    renderStatus();
    renderPreview();
    if (previewTimer) clearInterval(previewTimer);
    previewTimer = setInterval(renderPreview, 1000);
  }

  function showVerifyBox(kind, headline, res, note) {
    var html = '<div class="head">' + escapeHtml(headline) + '</div>';
    if (note) {
      html += '<div class="note">' + escapeHtml(note) + '</div>';
    }
    if (res && res.observed) {
      html += '<div class="rows">' +
        '<div class="r"><span>' + escapeHtml(t('labelObserved')) + '</span><span>' +
        escapeHtml(res.observed.tz) + ' · ' + escapeHtml(CTZ.formatOffset(res.observed.offsetMinutes)) + '</span></div>' +
        '<div class="r"><span>' + escapeHtml(t('labelExpected')) + '</span><span>' +
        escapeHtml(res.expected) + '</span></div>' +
        '<div class="r"><span>' + escapeHtml(t('verifyObservedTime')) + '</span><span>' +
        escapeHtml(res.observed.local || '') + '</span></div>' +
        '</div>';
    }
    els.verifyBox.innerHTML = html;
    els.verifyBox.className = 'verify ' + (kind === 'busy' ? 'busy' : kind);
    els.verifyBox.classList.remove('hidden');
  }

  /* ---------------- actions ---------------- */

  function doApply() {
    if (!selected) return;
    setBusy(true);
    CTZ.messaging.send({ type: 'ctz:apply', tabId: state.tabId, timezone: selected, mode: els.mode.value })
      .then(function (res) {
        if (!res || !res.ok) {
          showVerifyBox('err', (res && res.error) || t('errDebuggerAttach'), null);
          return;
        }
        if (res.warning === 'errDebuggerAttach') {
          showVerifyBox('err', t('errDebuggerAttach'), null);
        }
        if (res.reloaded) {
          showVerifyBox('busy', t('verifyRunning'), null);
          waitForReloadThenVerify();
        } else {
          setTimeout(doVerify, 350);
        }
      })
      .catch(function (e) {
        showVerifyBox('err', String((e && e.message) || e), null);
      })
      .then(function () { setBusy(false); });
  }

  function waitForReloadThenVerify() {
    var fired = false;
    var timer = setTimeout(function () { finish(); }, 8000);
    function listener(tabId, info) {
      if (fired || tabId !== state.tabId || info.status !== 'complete') return;
      fired = true;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      setTimeout(doVerify, 300);
    }
    function finish() {
      if (fired) return;
      fired = true;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      setTimeout(doVerify, 300);
    }
    chrome.tabs.onUpdated.addListener(listener);
  }

  function doVerify() {
    showVerifyBox('busy', t('verifyRunning'), null);
    CTZ.messaging.send({ type: 'ctz:verify', tabId: state.tabId })
      .then(function (res) {
        if (!res || !res.ok) {
          showVerifyBox('err', (res && res.error) || t('errDebuggerAttach'), null);
        } else if (!res.observed) {
          showVerifyBox('err', t('verifyNeedPage'), null);
        } else if (res.pass) {
          showVerifyBox('ok', t('verifyPass'), res, res.mode === 'cdp' ? t('cdpBannerNote') : null);
        } else {
          showVerifyBox('err', res.detached ? t('verifyDetached') : t('verifyFail'), res);
        }
      })
      .catch(function (e) {
        showVerifyBox('err', String((e && e.message) || e), null);
      });
  }

  function doReset() {
    setBusy(true);
    CTZ.messaging.send({ type: 'ctz:reset', tabId: state.tabId })
      .then(function () {
        state.tab = null;
        selected = 'system';
        renderStatus();
        buildList();
        renderFav();
        renderPreview();
        showVerifyBox('ok', t('statusNone'), null);
        setTimeout(doVerify, 350);
      })
      .catch(function (e) {
        showVerifyBox('err', String((e && e.message) || e), null);
      })
      .then(function () { setBusy(false); });
  }

  function doRandom() {
    setBusy(true);
    CTZ.messaging.send({ type: 'ctz:random', tabId: state.tabId })
      .then(function (res) {
        if (!res || !res.ok) {
          showVerifyBox('err', (res && res.error) || t('errDebuggerAttach'), null);
          return;
        }
        selected = res.timezone;
        state.tab = { timezone: res.timezone, mode: res.mode, status: 'applied' };
        renderStatus();
        buildList();
        renderFav();
        renderPreview();
        if (res.reloaded) {
          showVerifyBox('busy', t('verifyRunning'), null);
          waitForReloadThenVerify();
        } else {
          setTimeout(doVerify, 350);
        }
      })
      .catch(function (e) {
        showVerifyBox('err', String((e && e.message) || e), null);
      })
      .then(function () { setBusy(false); });
  }

  function doFavToggle() {
    if (!selected || selected === 'system') return;
    CTZ.messaging.send({ type: 'ctz:setFavorite', timezone: selected })
      .then(function (res) {
        state.favorites = res.favorites || [];
        renderFav();
      });
  }

  /* ---------------- wiring ---------------- */

  els.list.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.item') : null;
    if (!btn) return;
    selected = btn.getAttribute('data-tz');
    buildList();
    renderFav();
    renderPreview();
  });

  els.favChips.addEventListener('click', function (e) {
    var chip = e.target.closest ? e.target.closest('.chip') : null;
    if (!chip) return;
    selected = chip.getAttribute('data-tz');
    buildList();
    renderFav();
    renderPreview();
  });

  els.search.addEventListener('input', buildList);
  els.mode.addEventListener('change', function () {
    els.modeHint.textContent = modeHintText(els.mode.value);
  });
  els.btnApply.addEventListener('click', doApply);
  els.btnReset.addEventListener('click', doReset);
  els.btnVerify.addEventListener('click', doVerify);
  els.btnRandom.addEventListener('click', doRandom);
  els.favToggle.addEventListener('click', doFavToggle);
  els.btnOptions.addEventListener('click', function () {
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
    else window.open(chrome.runtime.getURL('options/options.html'));
  });
  els.introTip.addEventListener('click', function () {
    els.introTip.classList.add('hidden');
    CTZ.storage.set({ introSeen: true });
  });

  /* ---------------- init ---------------- */

  CTZ.messaging.activeTab()
    .then(function (tab) {
      state.tabId = tab && tab.id != null ? tab.id : null;
      state.tabUrl = (tab && tab.url) || '';
      return CTZ.messaging.send({ type: 'ctz:getState', tabId: state.tabId });
    })
    .then(function (st) {
      state.settings = st.settings || {};
      state.favorites = st.favorites || [];
      state.tab = st.tab || null;
      return CTZ.i18n.init(st.settings && st.settings.language);
    })
    .then(function () {
      CTZ.i18n.apply(document);
      document.title = t('extName');
      els.ver.textContent = 'v' + chrome.runtime.getManifest().version;
      showIntroTip();
      return CTZ.loadTimezones();
    })
    .then(function (data) {
      tzData = data;
      if (state.tab && state.tab.timezone) selected = state.tab.timezone;
      else if (state.settings.defaultTimezone && state.settings.defaultTimezone !== 'system') {
        selected = state.settings.defaultTimezone;
      } else selected = 'system';
      renderAll();
    })
    .catch(function (e) {
      els.tabStatus.textContent = String((e && e.message) || e);
    });
})();
