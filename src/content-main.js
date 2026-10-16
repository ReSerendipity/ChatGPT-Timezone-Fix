/*
 * Change Timezone — MAIN-world content script (the "page script" mode).
 *
 * Goal: make the page's Date / Intl report a chosen IANA timezone while the
 * real clock (getTime / epoch) stays untouched — same instant, different
 * wall clock, exactly what a real timezone change looks like to a page.
 *
 * Config channel (no chrome.* access here):
 *   1. synchronous per-frame: window.name prefix "CTZ:{json}" or
 *      sessionStorage key "__ctz_cfg"  (written by the isolated controller)
 *   2. asynchronous fallback: window message {source:'ctz-controller',
 *      type:'ctz-config', timezone} (also used for live updates)
 *
 * Known limitations (documented in README): parsing date/time strings
 * without an explicit zone still uses the real system zone; format()
 * output of DateTimeFormat instances created before document_start is
 * not rewritten.
 */
(function () {
  'use strict';
  if (window.__CTZ_MAIN__) return;
  window.__CTZ_MAIN__ = true;

  var CTZ = window.CTZ;
  var SYSTEM_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
  var CFG_KEY = '__ctz_cfg__';
  var NAME_PREFIX = 'CTZ:';

  var target = null;      // active spoof target (IANA id) or null
  var patched = false;

  /* ---------------- config reading ---------------- */

  function readSyncConfig() {
    try {
      var n = window.name;
      if (typeof n === 'string' && n.indexOf(NAME_PREFIX) === 0) {
        var c = JSON.parse(n.slice(NAME_PREFIX.length));
        if (c && c.timezone) return c;
      }
    } catch (e) { /* fall through */ }
    try {
      var s = window.sessionStorage && window.sessionStorage.getItem(CFG_KEY);
      if (s) {
        var c2 = JSON.parse(s);
        if (c2 && c2.timezone) return c2;
      }
    } catch (e) { /* fall through */ }
    return null;
  }

  function applyConfig(tz) {
    if (tz === target) return;
    target = tz;
    if (tz && tz !== SYSTEM_TZ) install();
    else uninstall();
  }

  /* ---------------- Date spoofer ---------------- */

  var proto = Date.prototype;
  var orig = {};
  var OrigDTF = Intl.DateTimeFormat;

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function deltaMs(d) {
    return CTZ.tzOffsetMs(target, d) - CTZ.tzOffsetMs(SYSTEM_TZ, d);
  }

  function shifted(d) {
    return new Date(d.getTime() + deltaMs(d));
  }

  function gmtString(d) {
    var offMin = CTZ.zoneOffsetMinutes(target, d); // e.g. -480 for UTC+8
    var sign = offMin > 0 ? '-' : '+';
    var abs = Math.abs(offMin);
    return 'GMT' + sign + pad2(Math.floor(abs / 60)) + pad2(abs % 60);
  }

  function wallParts(d) {
    var s = shifted(d);
    return {
      dow: s.getUTCDay(),
      day: s.getUTCDate(),
      month: s.getUTCMonth(),
      year: s.getUTCFullYear(),
      hour: s.getUTCHours(),
      minute: s.getUTCMinutes(),
      second: s.getUTCSeconds(),
      ms: s.getUTCMilliseconds(),
    };
  }

  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function install() {
    if (patched) return;
    patched = true;

    orig.getFullYear = proto.getFullYear;
    proto.getFullYear = function () { return wallParts(this).year; };

    orig.getMonth = proto.getMonth;
    proto.getMonth = function () { return wallParts(this).month; };

    orig.getDate = proto.getDate;
    proto.getDate = function () { return wallParts(this).day; };

    orig.getDay = proto.getDay;
    proto.getDay = function () { return wallParts(this).dow; };

    orig.getHours = proto.getHours;
    proto.getHours = function () { return wallParts(this).hour; };

    orig.getMinutes = proto.getMinutes;
    proto.getMinutes = function () { return wallParts(this).minute; };

    orig.getSeconds = proto.getSeconds;
    proto.getSeconds = function () { return wallParts(this).second; };

    orig.getMilliseconds = proto.getMilliseconds;
    proto.getMilliseconds = function () { return wallParts(this).ms; };

    orig.getTimezoneOffset = proto.getTimezoneOffset;
    proto.getTimezoneOffset = function () {
      return CTZ.zoneOffsetMinutes(target, this);
    };

    orig.toString = proto.toString;
    proto.toString = function () {
      var p = wallParts(this);
      return DOW[p.dow] + ' ' + MON[p.month] + ' ' + pad2(p.day) + ' ' + p.year +
        ' ' + pad2(p.hour) + ':' + pad2(p.minute) + ':' + pad2(p.second) +
        ' ' + gmtString(this) + ' (' + target + ')';
    };

    orig.toTimeString = proto.toTimeString;
    proto.toTimeString = function () {
      var p = wallParts(this);
      return pad2(p.hour) + ':' + pad2(p.minute) + ':' + pad2(p.second) +
        ' ' + gmtString(this) + ' (' + target + ')';
    };

    orig.toDateString = proto.toDateString;
    proto.toDateString = function () {
      var p = wallParts(this);
      return DOW[p.dow] + ' ' + MON[p.month] + ' ' + pad2(p.day) + ' ' + p.year;
    };

    ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'].forEach(function (name) {
      orig[name] = proto[name];
      proto[name] = function () {
        var a = Array.prototype.slice.call(arguments);
        if (a.length > 1 && a[1] && typeof a[1] === 'object' && a[1].timeZone) {
          return orig[name].apply(this, a); // caller pinned an explicit zone
        }
        var opts = Object.assign({}, a.length > 1 && a[1] ? a[1] : null, { timeZone: target });
        return orig[name].call(this, a.length > 0 ? a[0] : undefined, opts);
      };
    });

    // Intl.DateTimeFormat: inject timeZone for new instances; rewrite
    // resolvedOptions() for legacy instances that were built without one.
    function WrappedDTF(locales, options) {
      if (!options || typeof options !== 'object' || !options.timeZone) {
        options = Object.assign({}, options, { timeZone: target });
      }
      return new OrigDTF(locales, options);
    }
    WrappedDTF.prototype = OrigDTF.prototype;
    WrappedDTF.supportedLocalesOf = OrigDTF.supportedLocalesOf.bind(OrigDTF);
    Intl.DateTimeFormat = WrappedDTF;

    orig.resolvedOptions = OrigDTF.prototype.resolvedOptions;
    OrigDTF.prototype.resolvedOptions = function () {
      var r = orig.resolvedOptions.call(this);
      if (r.timeZone === SYSTEM_TZ) {
        r = Object.assign({}, r, { timeZone: target });
      }
      return r;
    };
  }

  function uninstall() {
    if (!patched) return;
    patched = false;
    Object.keys(orig).forEach(function (k) {
      if (k === 'resolvedOptions') {
        OrigDTF.prototype.resolvedOptions = orig[k];
      } else {
        proto[k] = orig[k];
      }
    });
    Intl.DateTimeFormat = OrigDTF;
  }

  /* ---------------- controller channel ---------------- */

  window.addEventListener('message', function (e) {
    if (e.source !== window) return;
    var d = e.data;
    if (!d || d.source !== 'ctz-controller') return;

    if (d.type === 'ctz-config') {
      applyConfig(d.timezone || null);
    } else if (d.type === 'ctz-verify-request') {
      var now = new Date();
      window.postMessage({
        source: 'ctz-main',
        type: 'ctz-verify-response',
        requestId: d.requestId,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        offsetMinutes: now.getTimezoneOffset(),
        local: now.toString(),
      }, '*');
    }
  });

  var initial = readSyncConfig();
  if (initial && initial.timezone && initial.timezone !== SYSTEM_TZ) {
    applyConfig(initial.timezone);
  }
})();
