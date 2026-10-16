#!/usr/bin/env node
/*
 * Change Timezone — i18n 一致性校验（纯 Node.js，零依赖）。
 *
 * 检查项：
 *   1. _locales/ 下所有 messages.json 均为合法 JSON；
 *   2. 每个语言与 en 的键集合完全一致（缺失 / 多余都算错误）；
 *   3. $1、$2 等占位符在各语言间保持一致；
 *   4. 扫描 src/、popup/、options/、background/ 与 manifest.json 中的
 *      t('key')、data-i18n="key"（含 -title/-placeholder/-html 变体）、
 *      __MSG_key__，以及动态拼键 t('region' + r) 推导出的 regionXXX
 *      （region 取自 data/timezones.json 中实际出现的区域）：
 *        - 代码引用但 en 缺失   → 错误（退出码 1）
 *        - en 定义但无人引用   → 提示；RESERVED 中的预留键除外
 *
 * 用法：node scripts/check-i18n.mjs
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const LOCALES_DIR = join(root, '_locales');

// en 中已定义、暂时无人引用的预留键（仅提示，不算问题）。
const RESERVED = new Set(['optionRandom', 'labelFavorites', 'regionOther']);

// 需要扫描引用的源码目录 / 文件。
const SCAN_TARGETS = [
  join(root, 'src'),
  join(root, 'popup'),
  join(root, 'options'),
  join(root, 'background'),
  join(root, 'manifest.json'),
];

const errors = [];
const hints = [];
const infos = [];

/* ---------- 1. 读取并解析所有 messages.json ---------- */

function loadLocales() {
  if (!existsSync(LOCALES_DIR)) {
    errors.push('_locales/ 目录不存在，请先运行 tools/gen_locales.py');
    return null;
  }
  const locales = {};
  for (const code of readdirSync(LOCALES_DIR)) {
    const file = join(LOCALES_DIR, code, 'messages.json');
    if (!existsSync(file)) continue;
    try {
      locales[code] = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      errors.push(`${code}/messages.json 不是合法 JSON: ${e.message}`);
    }
  }
  return locales;
}

/* ---------- 2/3. 键集合与占位符一致性 ---------- */

function placeholders(msg) {
  const set = new Set();
  const re = /\$\d+/g;
  let m;
  while ((m = re.exec(msg)) !== null) set.add(m[0]);
  return [...set].sort().join(',');
}

function checkParity(locales) {
  const en = locales.en;
  if (!en) { errors.push('缺少 _locales/en/messages.json（default_locale）'); return; }
  const enKeys = Object.keys(en).sort();
  infos.push(`en 键数: ${enKeys.length}`);
  for (const [code, data] of Object.entries(locales)) {
    if (code === 'en') continue;
    const keys = Object.keys(data).sort();
    const missing = enKeys.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !enKeys.includes(k));
    if (missing.length) errors.push(`${code}: 缺少键 ${missing.join(', ')}`);
    if (extra.length) errors.push(`${code}: 多余键 ${extra.join(', ')}`);
    for (const k of enKeys) {
      if (!(k in data)) continue;
      const a = en[k];
      const b = data[k];
      if (typeof a.message !== 'string' || typeof b.message !== 'string') {
        errors.push(`${code}.${k}: message 不是字符串`);
        continue;
      }
      if (!a.message) errors.push(`${code}.${k}: message 为空`);
      const pa = placeholders(a.message);
      const pb = placeholders(b.message);
      if (pa !== pb) {
        errors.push(`${code}.${k}: 占位符不一致 — en=[${pa}] ${code}=[${pb}]`);
      }
    }
  }
}

/* ---------- 4. 源码引用扫描 ---------- */

function collectFiles(target) {
  if (!existsSync(target)) return [];
  const st = statSync(target);
  if (st.isFile()) return [target];
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(js|mjs|html|json)$/.test(name)) out.push(p);
    }
  };
  walk(target);
  return out;
}

function stripComments(file, text) {
  if (/\.(js|mjs)$/.test(file)) {
    // 先剥块注释，再剥行注释（':' 前的 // 视为 URL，不剥）。
    return text
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  }
  if (/\.html?$/.test(file)) {
    return text.replace(/<!--[\s\S]*?-->/g, ' ');
  }
  return text;
}

function scanReferences(locales) {
  const en = locales.en || {};
  const enKeys = new Set(Object.keys(en));
  const used = new Set();
  const files = SCAN_TARGETS.flatMap(collectFiles);

  // data/timezones.json 中实际出现的区域（用于推导 regionXXX 动态键）。
  const tzFile = join(root, 'data', 'timezones.json');
  if (existsSync(tzFile)) {
    const tz = JSON.parse(readFileSync(tzFile, 'utf8'));
    for (const zone of tz.zones || []) {
      if (zone.region) used.add('region' + zone.region);
    }
  }

  // t(...) 调用内出现的所有字符串字面量都视为 key（兼容三元 / 数组参数），
  // 但动态前缀 'region' 由下方 reRegion 单独推导，不计入。
  const reCall = /\bt\(([^)]*)\)/g;
  const reStr = /['"]([A-Za-z0-9_]+)['"]/g;
  const reRegion = /t\(\s*['"]region['"]\s*\+/;
  const reAttr = /data-i18n(?:-title|-placeholder|-html)?\s*=\s*"([A-Za-z0-9_]+)"/g;
  const reMsg = /__MSG_([A-Za-z0-9_]+)__/g;

  for (const file of files) {
    const text = stripComments(file, readFileSync(file, 'utf8'));
    const rel = file.slice(root.length + 1).split(sep).join('/');
    const dynamicRegion = reRegion.test(text);
    let m;
    reCall.lastIndex = 0;
    while ((m = reCall.exec(text)) !== null) {
      let s;
      reStr.lastIndex = 0;
      while ((s = reStr.exec(m[1])) !== null) {
        if (dynamicRegion && s[1] === 'region') continue;
        used.add(s[1]);
      }
    }
    reAttr.lastIndex = 0;
    while ((m = reAttr.exec(text)) !== null) used.add(m[1]);
    reMsg.lastIndex = 0;
    while ((m = reMsg.exec(text)) !== null) used.add(m[1]);
    if (dynamicRegion) {
      infos.push(`${rel}: 检测到动态键 t('region' + r)，按 data/timezones.json 的区域清单核对`);
    }
  }

  for (const key of [...used].sort()) {
    if (!enKeys.has(key)) errors.push(`代码引用了 en 中不存在的 key: ${key}`);
  }
  for (const key of enKeys) {
    if (!used.has(key) && !RESERVED.has(key)) {
      hints.push(`en 已定义但无人引用: ${key}`);
    }
  }
  infos.push(`源码引用 key 数: ${used.size}`);
}

/* ---------- main ---------- */

const locales = loadLocales();
if (locales) {
  checkParity(locales);
  scanReferences(locales);
}

for (const line of infos) console.log(`[info] ${line}`);
for (const line of hints) console.log(`[hint] ${line}`);
for (const line of errors) console.error(`[ERROR] ${line}`);
if (errors.length) {
  console.error(`\ncheck-i18n 失败: ${errors.length} 个错误`);
  process.exit(1);
}
console.log(`\ncheck-i18n 通过: ${Object.keys(locales).length} 个语言、键集合与占位符一致、引用完整`);
