/*
 * Change Timezone — shared helpers (plain script, no chrome.* at load time).
 * Loaded in extension pages (popup/options), in the isolated-world content
 * controller, and in the MAIN-world Date spoofer (where no extension APIs
 * are available — everything here must be pure JS).
 */
(function () {
  'use strict';
  if (window.CTZ) return;

  var CTZ = {};

  /* ---------- formatting ---------- */

  // Minutes -> "UTC+08:00" / "UTC-05:30"
  CTZ.formatOffset = function (minutes) {
    var sign = minutes > 0 ? '-' : '+';
    var m = Math.abs(minutes);
    var hh = String(Math.floor(m / 60)).padStart(2, '0');
    var mm = String(m % 60).padStart(2, '0');
    return 'UTC' + sign + hh + ':' + mm;
  };

  // Current UTC offset (in minutes, Chrome sign convention) of a zone.
  CTZ.zoneOffsetMinutes = function (timeZone, date) {
    return -CTZ.tzOffsetMs(timeZone, date || new Date()) / 60000;
  };

  // Offset of `timeZone` relative to UTC, in milliseconds (positive = east).
  // Compatible with DST: recomputed per minute and cached.
  CTZ.tzOffsetMs = (function () {
    var cache = new Map();
    var fmtCache = new Map();
    function formatter(tz) {
      var f = fmtCache.get(tz);
      if (!f) {
        f = new Intl.DateTimeFormat('en-US', {
          timeZone: tz, hourCycle: 'h23',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        fmtCache.set(tz, f);
      }
      return f;
    }
    return function (tz, date) {
      var key = tz + '|' + Math.floor(date.getTime() / 60000);
      var hit = cache.get(key);
      if (hit !== undefined) return hit;
      var parts = formatter(tz).formatToParts(date);
      var p = {};
      for (var i = 0; i < parts.length; i++) p[parts[i].type] = parts[i].value;
      var asUTC = Date.UTC(
        Number(p.year), Number(p.month) - 1, Number(p.day),
        Number(p.hour), Number(p.minute), Number(p.second)
      );
      var off = asUTC - (date.getTime() - date.getMilliseconds());
      if (cache.size > 600) cache.clear();
      cache.set(key, off);
      return off;
    };
  })();

  CTZ.systemTimezone = function () {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  };

  CTZ.nowIn = function (timeZone, localeStr) {
    try {
      return new Intl.DateTimeFormat(localeStr || undefined, {
        timeZone: timeZone, dateStyle: 'full', timeStyle: 'medium',
      }).format(new Date());
    } catch (e) {
      return new Date().toLocaleString();
    }
  };

  /* ---------- extension context helpers (isolated pages only) ---------- */

  CTZ.hasExtensionApi = function () {
    return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
  };

  CTZ.storage = {
    get: function (keys) { return chrome.storage.local.get(keys); },
    set: function (obj) { return chrome.storage.local.set(obj); },
    onChange: function (cb) {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area === 'local') cb(changes);
      });
    },
  };

  CTZ.messaging = {
    send: function (msg) { return chrome.runtime.sendMessage(msg); },
    activeTab: function () {
      return chrome.tabs.query({ active: true, currentWindow: true })
        .then(function (t) { return t && t[0]; });
    },
  };

  /* ---------- timezone dataset (extension pages only) ---------- */

  CTZ.loadTimezones = function () {
    if (CTZ._tz) return Promise.resolve(CTZ._tz);
    return fetch(chrome.runtime.getURL('data/timezones.json'))
      .then(function (r) { return r.json(); })
      .then(function (data) { CTZ._tz = data; return data; });
  };

  window.CTZ = CTZ;
})();
