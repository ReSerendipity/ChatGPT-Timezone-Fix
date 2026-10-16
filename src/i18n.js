/*
 * Change Timezone — i18n loader (isolated extension pages & controller only).
 * Auto: browser UI language via chrome.i18n. Manual override: fetch the
 * selected _locales file directly (content scripts / popup reopen).
 */
(function () {
  'use strict';
  if (!window.CTZ) throw new Error('common.js must load before i18n.js');

  var SUPPORTED = ['en', 'zh_CN', 'zh_TW', 'ja', 'ko', 'es', 'pt_BR', 'fr', 'de', 'ru', 'it', 'tr', 'id', 'vi'];
  var cache = {};        // locale -> parsed messages.json
  var current = 'en';

  function normalize(code) {
    return String(code || 'en').replace('-', '_');
  }

  function preferred() {
    var ui = 'en';
    try { ui = chrome.i18n.getUILanguage(); } catch (e) { /* keep en */ }
    var n = normalize(ui);
    if (SUPPORTED.indexOf(n) !== -1) return n;
    var base = n.split('_')[0];
    for (var i = 0; i < SUPPORTED.length; i++) {
      if (SUPPORTED[i].split('_')[0] === base) return SUPPORTED[i];
    }
    return 'en';
  }

  function load(locale) {
    if (locale === 'en' || cache[locale]) return Promise.resolve(cache[locale] || null);
    return fetch(chrome.runtime.getURL('_locales/' + locale + '/messages.json'))
      .then(function (r) { return r.json(); })
      .then(function (data) { cache[locale] = data; return data; })
      .catch(function () { return null; });
  }

  function applySubs(msg, subs) {
    if (!subs) return msg;
    for (var i = 0; i < subs.length; i++) {
      msg = msg.split('$' + (i + 1)).join(subs[i]);
    }
    return msg;
  }

  var i18n = {
    supported: SUPPORTED.slice(),
    get locale() { return current; },

    init: function (lang) {
      var want = (lang && lang !== 'auto' && SUPPORTED.indexOf(lang) !== -1) ? lang : preferred();
      return load(want).then(function () { current = want; });
    },

    // t('key') or t('key', ['sub1','sub2'])
    t: function (key, subs) {
      var data = cache[current];
      var entry = data && data[key];
      var msg = entry && entry.message;
      if (msg == null) {
        try { msg = chrome.i18n.getMessage(key); } catch (e) { msg = null; }
      }
      if (msg == null) msg = key;
      return applySubs(msg, subs);
    },

    has: function (key) {
      var data = cache[current];
      return !!(data && data[key]) || !!(chrome.i18n && chrome.i18n.getMessage(key));
    },

    // Wire [data-i18n], [data-i18n-title], [data-i18n-placeholder], [data-i18n-html]
    apply: function (root) {
      root = root || document;
      root.querySelectorAll('[data-i18n]').forEach(function (el) {
        el.textContent = i18n.t(el.getAttribute('data-i18n'));
      });
      root.querySelectorAll('[data-i18n-title]').forEach(function (el) {
        el.title = i18n.t(el.getAttribute('data-i18n-title'));
      });
      root.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
        el.placeholder = i18n.t(el.getAttribute('data-i18n-placeholder'));
      });
      root.querySelectorAll('[data-i18n-html]').forEach(function (el) {
        el.innerHTML = i18n.t(el.getAttribute('data-i18n-html'));
      });
      try { document.documentElement.lang = current.replace('_', '-'); } catch (e) { /* noop */ }
    },
  };

  window.CTZ.i18n = i18n;
})();
