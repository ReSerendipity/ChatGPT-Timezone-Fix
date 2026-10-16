/*
 * Change Timezone — MV3 background service worker.
 *
 * State (chrome.storage.local):
 *   settings  {mode, defaultTimezone, reloadOnApply, badge, language}
 *   tabs      {<tabId>: {timezone, mode: 'cdp'|'script', status, at}}
 *   favorites [timezoneId, ...]
 *
 * Two override engines ("mode"):
 *   cdp    — chrome.debugger + Emulation.setTimezoneOverride: REAL per-tab
 *            timezone change; Chrome shows a debugging banner on the tab.
 *   script — page-script mode: MAIN-world Date/Intl spoofer driven through
 *            window.name / sessionStorage config.
 * 'auto' tries cdp first and falls back to script.
 */
'use strict';

var DEFAULTS = {
  mode: 'auto',               // 'auto' | 'cdp' | 'script'
  defaultTimezone: 'system',  // 'system' | IANA id
  reloadOnApply: true,
  badge: true,
  language: 'auto',
};

var tzCache = null;

/* ---------------- state helpers ---------------- */

function getState() {
  return chrome.storage.local.get(['settings', 'tabs', 'favorites']).then(function (data) {
    return {
      settings: Object.assign({}, DEFAULTS, data.settings || {}),
      tabs: data.tabs || {},
      favorites: data.favorites || [],
    };
  });
}

function offsetMinutesOf(timeZone) {
  return -CTZ_INLINE.tzOffsetMs(timeZone, new Date()) / 60000;
}

// Minimal pure-JS helper copy (service workers cannot share src/common.js
// context; keep it tiny and dependency-free).
var CTZ_INLINE = {
  _cache: {},
  _fmt: {},
  tzOffsetMs: function (tz, date) {
    var key = tz + '|' + Math.floor(date.getTime() / 60000);
    var hit = this._cache[key];
    if (hit !== undefined) return hit;
    var f = this._fmt[tz];
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      this._fmt[tz] = f;
    }
    var parts = f.formatToParts(date);
    var p = {};
    for (var i = 0; i < parts.length; i++) p[parts[i].type] = parts[i].value;
    var asUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day),
      Number(p.hour), Number(p.minute), Number(p.second));
    var off = asUTC - (date.getTime() - date.getMilliseconds());
    if (Object.keys(this._cache).length > 600) this._cache = {};
    this._cache[key] = off;
    return off;
  },
};

/* ---------------- timezone data ---------------- */

function loadTzData() {
  if (tzCache) return Promise.resolve(tzCache);
  return fetch(chrome.runtime.getURL('data/timezones.json'))
    .then(function (r) { return r.json(); })
    .then(function (d) { tzCache = d; return d; });
}

function randomTimezone() {
  return loadTzData().then(function (d) {
    var pool = d.zones.filter(function (z) { return z.popular; });
    if (!pool.length) pool = d.zones;
    var tz = pool[Math.floor(Math.random() * pool.length)].id;
    return tz;
  });
}

/* ---------------- badge ---------------- */

function badgeText(tabState) {
  if (!tabState) return '';
  if (tabState.status === 'detached') return '!';
  var offMin = offsetMinutesOf(tabState.timezone);
  var sign = offMin > 0 ? '-' : '+';
  var abs = Math.abs(offMin);
  var hh = String(Math.floor(abs / 60)).padStart(2, '0');
  var mm = String(abs % 60).padStart(2, '0');
  return hh + mm;
}

function setBadge(tabId, tabState) {
  var text = badgeText(tabState);
  return chrome.action.setBadgeText({ tabId: tabId, text: text }).catch(function () { });
}

/* ---------------- engines ---------------- */

function cdpApply(tabId, timezone) {
  var target = { tabId: tabId };
  return chrome.debugger.attach(target, '1.3').catch(function (e) {
    var msg = String(e && e.message || e).toLowerCase();
    if (msg.indexOf('already attached') === -1) throw e;
  }).then(function () {
    return chrome.debugger.sendCommand(target, 'Emulation.setTimezoneOverride', {
      timezoneId: timezone,
    });
  });
}

function pushScriptConfig(tabId, timezone) {
  return chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function (tz) {
      try {
        if (window.top === window) {
          if (tz) {
            var payload = JSON.stringify({ timezone: tz, ts: Date.now() });
            window.name = 'CTZ:' + payload;
            window.sessionStorage.setItem('__ctz_cfg', payload);
          } else {
            window.name = '';
            window.sessionStorage.removeItem('__ctz_cfg');
          }
        }
      } catch (e) { /* not injectable (chrome:// etc.) */ }
    },
    args: [timezone],
  }).catch(function () { /* page refuses injection — state still tracked */ });
}

/* ---------------- actions ---------------- */

function applyTimezone(tabId, timezone, modeOverride) {
  if (!timezone || timezone === 'system') {
    return resetTab(tabId);
  }
  return getState().then(function (st) {
    var requested = modeOverride || st.settings.mode || 'auto';
    var effective = 'script';
    var warning = null;
    if (requested !== 'script') {
      return cdpApply(tabId, timezone).then(function () {
        effective = 'cdp';
      }, function (e) {
        if (requested === 'cdp') throw e;
        warning = 'errDebuggerAttach';
        effective = 'script';
      });
    }
    return { effective: effective, warning: warning };
  }).then(function (r) {
    var effective = r.effective;
    if (effective === 'script') {
      return pushScriptConfig(tabId, timezone).then(function () {
        return st0().then(function (settings) {
          if (settings.reloadOnApply) {
            return chrome.tabs.reload(tabId).catch(function () { }).then(function () {
              return { effective: effective, warning: r.warning, reloaded: true };
            });
          }
          return { effective: effective, warning: r.warning, reloaded: false };
        });
      });
    }
    return { effective: effective, warning: r.warning, reloaded: false };
  }).then(function (r) {
    return getState().then(function (st) {
      st.tabs[tabId] = {
        timezone: timezone,
        mode: r.effective,
        status: 'applied',
        at: Date.now(),
      };
      return chrome.storage.local.set({ tabs: st.tabs }).then(function () {
        return setBadge(tabId, st.tabs[tabId]).then(function () {
          return {
            ok: true,
            mode: r.effective,
            timezone: timezone,
            reloaded: r.reloaded,
            warning: r.warning,
          };
        });
      });
    });
  });
}

function st0() {
  return getState().then(function (s) { return s.settings; });
}

function resetTab(tabId) {
  return getState().then(function (st) {
    var t = st.tabs[tabId];
    var chain = Promise.resolve();
    if (t && t.mode === 'cdp') {
      chain = chrome.debugger.sendCommand({ tabId: tabId }, 'Emulation.setTimezoneOverride', {
        timezoneId: '',
      }).catch(function () { }).then(function () {
        return chrome.debugger.detach({ tabId: tabId }).catch(function () { });
      });
    }
    return chain.then(function () {
      delete st.tabs[tabId];
      return chrome.storage.local.set({ tabs: st.tabs });
    });
  }).then(function () {
    return pushScriptConfig(tabId, null);
  }).then(function () {
    return setBadge(tabId, null);
  }).then(function () {
    return { ok: true, timezone: null };
  });
}

function verifyTab(tabId) {
  return getState().then(function (st) {
    var expected = st.tabs[tabId] && st.tabs[tabId].timezone ? st.tabs[tabId].timezone : 'system';
    var systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    var expectedTz = expected === 'system' ? systemTz : expected;
    return observeTab(tabId).then(function (observed) {
      var pass = !!observed && observed.tz === expectedTz;
      var detached = !!(st.tabs[tabId] && st.tabs[tabId].status === 'detached');
      return { ok: true, expected: expectedTz, observed: observed, pass: pass, detached: detached };
    });
  });
}

function observeTab(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: 'ctz:observe' })
    .then(function (res) { return res || null; })
    .catch(function () { return null; })
    .then(function (res) {
      if (res && res.tz) return res;
      // Fallback: evaluate directly in the page (works for CDP mode even
      // when the content controller has not answered in time).
      return chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function () {
          var d = new Date();
          return {
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            offsetMinutes: d.getTimezoneOffset(),
            local: d.toString(),
          };
        },
      }).then(function (r) {
        return r && r[0] && r[0].result ? r[0].result : null;
      }).catch(function () { return null; });
    });
}

/* ---------------- message router ---------------- */

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  var task = (async function () {
    try {
      switch (msg && msg.type) {
        case 'ctz:hello': {
          var tabId = sender.tab && sender.tab.id;
          var st = await getState();
          return {
            tabId: tabId == null ? null : tabId,
            tab: tabId == null ? null : (st.tabs[tabId] || null),
            settings: st.settings,
          };
        }
        case 'ctz:getState': {
          var st2 = await getState();
          return {
            settings: st2.settings,
            tabs: st2.tabs,
            favorites: st2.favorites,
            tab: st2.tabs[msg.tabId] || null,
          };
        }
        case 'ctz:apply':
          return await applyTimezone(msg.tabId, msg.timezone, msg.mode);
        case 'ctz:reset':
          return await resetTab(msg.tabId);
        case 'ctz:random': {
          var tz = await randomTimezone();
          return await applyTimezone(msg.tabId, tz);
        }
        case 'ctz:verify':
          return await verifyTab(msg.tabId);
        case 'ctz:setFavorite': {
          var st3 = await getState();
          var favs = st3.favorites.slice();
          var idx = favs.indexOf(msg.timezone);
          if (idx === -1) favs.push(msg.timezone); else favs.splice(idx, 1);
          await chrome.storage.local.set({ favorites: favs });
          return { ok: true, favorites: favs };
        }
        default:
          return null;
      }
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  })();
  task.then(sendResponse);
  return true;
});

/* ---------------- lifecycle ---------------- */

chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.local.get('settings').then(function (d) {
    if (!d.settings) return chrome.storage.local.set({ settings: DEFAULTS });
  });
  chrome.action.setBadgeBackgroundColor({ color: '#16A34A' }).catch(function () { });
});

chrome.runtime.onStartup.addListener(function () {
  chrome.action.setBadgeBackgroundColor({ color: '#16A34A' }).catch(function () { });
});

// Debugger banner closed by the user -> mark detached so the popup can warn.
chrome.debugger.onDetach.addListener(function (source) {
  var tabId = source && source.tabId;
  if (tabId == null) return;
  getState().then(function (st) {
    var t = st.tabs[tabId];
    if (t && t.status !== 'detached') {
      t.status = 'detached';
      return chrome.storage.local.set({ tabs: st.tabs }).then(function () {
        return setBadge(tabId, t);
      });
    }
  });
});

// Re-assert the CDP override after navigation (it survives reloads while the
// debugger stays attached, but re-applying is cheap and keeps state honest).
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
  if (changeInfo.status !== 'complete') return;
  getState().then(function (st) {
    var t = st.tabs[tabId];
    if (t && t.mode === 'cdp' && t.status === 'applied') {
      cdpApply(tabId, t.timezone).catch(function () { });
    }
  });
});

chrome.tabs.onRemoved.addListener(function (tabId) {
  getState().then(function (st) {
    if (st.tabs[tabId]) {
      delete st.tabs[tabId];
      chrome.storage.local.set({ tabs: st.tabs });
    }
  });
});

chrome.commands.onCommand.addListener(function (command) {
  if (command !== 'random-timezone') return;
  chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
    var tab = tabs && tabs[0];
    if (tab && tab.id != null) {
      randomTimezone().then(function (tz) {
        return applyTimezone(tab.id, tz);
      });
    }
  });
});
