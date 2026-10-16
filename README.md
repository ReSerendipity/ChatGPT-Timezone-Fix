# Change Timezone

[中文说明](#修改时区) | Free & open source (Apache-2.0) timezone switcher for Chrome / Edge (Manifest V3)


## Features

- **Per-tab timezone switching** — click the toolbar icon and change *only the current tab's* timezone to a random or a specific IANA timezone. Other tabs and your system clock stay untouched.
- **Dual override engines**, switchable in the popup:
  - `cdp` — via `chrome.debugger` + CDP `Emulation.setTimezoneOverride`: a **real** per-tab timezone change at browser level. Chrome shows a "debugging" banner on the tab while attached.
  - `script` — a MAIN-world content script rewrites the page's `Date` / `Intl` results. Lightweight, no banner, but only affects page scripts.
  - `auto` (default) — prefers `cdp`, automatically falls back to `script` when the debugger cannot be attached.
- **Instant effect verification** — after every apply, the extension automatically reads the timezone the page *actually* reports and compares it with your selection (PASS / FAIL). Verification surfaces in the popup panel, the floating on-page badge, and the options page table.
- **386 IANA time zones** + 28 popular ones, grouped by region with instant search.
- **Random timezone** — random button in the popup, or the keyboard shortcut `Ctrl+Shift+Z` on the active tab.
- **Favorites** — star any timezone; favorite chips stay at the top of the popup list.
- **Floating verification badge** — optional on-page card showing expected vs. observed time zone with an in-effect / not-in-effect chip.
- **14 languages**: English, 简体中文, 繁體中文, 日本語, 한국어, Español, Português (Brasil), Français, Deutsch, Русский, Italiano, Türkçe, Bahasa Indonesia, Tiếng Việt.

## Screenshots

_Coming soon — popup, verification panel and the floating on-page badge._

## Install (load unpacked)

1. Clone or download this repository. Any folder name works when loading — `change-timezone` is just the name that matches the repository.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the `change-timezone` folder.
5. Pin the extension and click its toolbar icon.

## Usage

1. Click the toolbar icon on the tab you want to change.
2. Pick a method (`Auto` / `Browser timezone` / `Page script`) and a time zone (or hit **Random**).
3. Press **Apply**. The popup runs an automatic verification and shows the result:

   | Row | Meaning |
   | --- | --- |
   | Observed | The time zone (and UTC offset / local time) the page actually reads |
   | Expected | The time zone you selected |
   | Result | PASS when observed == expected, otherwise FAIL |

4. **Reset** restores the system default for the tab.

**About the CDP ("browser timezone") mode:** it really changes the tab's time zone at browser level — every page sees the new zone. While the debugger is attached, Chrome displays an "… is debugging this browser" banner on the tab; closing the banner detaches the debugger and the extension marks the tab as *detached* (the popup then suggests re-applying).

**Limits of the "page script" mode:** `Date` / `Intl` are rewritten inside the page. If the page finished loading before the config was pushed, a reload may be needed (the "Reload the tab after applying" option in Settings is on by default). Parsing date/time strings **without** an explicit time zone still uses the real system zone — an OS-level catch that no in-page script can fully replace. For a truly complete effect, use the CDP mode.

## FAQ

**"Load unpacked" shows an error** — make sure you selected the *inner* folder that directly contains `manifest.json` (e.g. `change-timezone-main/`), not the ZIP file and not the folder that contains it.

**Chrome shows a "… is debugging this browser" banner on the tab** — that's expected in the browser-level (CDP) method; it's how the real per-tab override stays active. Closing the banner detaches it — press Apply again to restore. Prefer no banner? Switch to the page-script method.

**Can I change the Ctrl+Shift+Z shortcut?** — yes: open `chrome://extensions/shortcuts` (Edge: `edge://extensions/shortcuts`) and edit "Apply a random timezone to the current tab".

**Why does the extension ask for broad permissions?** — `debugger` implements the browser-level timezone override; `scripting` / `tabs` / host access push the config into the page and read back what the page actually sees. Nothing leaves your machine — there is no analytics, tracking or network call in the code.

**The page still shows the old time** — in page-script mode, a page that finished loading before the config was pushed may need a reload (the "Reload the tab after applying" option is on by default). For a completely native effect, use the browser-level (CDP) method.

## Development

All three generators are idempotent and safe to re-run. On this machine the Python interpreter (with Pillow for icon generation) lives at:

```
C:/Users/Doro/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe
```

```bash
# regenerate data/timezones.json (only when the curated zone list changes)
python tools/gen_data.py

# regenerate icons/ (PNG 16/32/48/128 + gray -off variants + icon.svg)
python tools/make_icons.py

# regenerate _locales/*/messages.json (14 languages)
python tools/gen_locales.py

# i18n consistency check (JSON validity, key-set parity with en, $placeholders,
# t('key') / data-i18n="key" reference scan) — pure Node, no dependencies
node scripts/check-i18n.mjs

# build dist/change-timezone-<version>.zip (runtime files only)
python scripts/package.py
```

Requires: Python 3 + Pillow (icons only); Node.js (check script only). No other dependencies.

### Adding a new language

1. Add a language block to the `T` dictionary in `tools/gen_locales.py` (copy any existing block and translate the values).
2. Run `python tools/gen_locales.py`.
3. Add the locale code to `SUPPORTED` in `src/i18n.js` and the native name to `LANG_NAMES` in `options/options.js`.
4. Run `node scripts/check-i18n.mjs` to confirm parity.

## Repository layout

```
change-timezone/
├── .gitignore
├── LICENSE                       # Apache-2.0
├── README.md
├── manifest.json                 # MV3 manifest (minimum Chrome 111)
├── _locales/                     # 14 languages (generated)
│   └── <locale>/messages.json
├── background/
│   └── background.js             # message router, CDP + script engines, badge, shortcuts
├── data/
│   └── timezones.json            # 386 IANA zones, 28 popular (generated)
├── icons/                        # 16/32/48/128 PNG + -off gray variants + icon.svg (generated)
├── options/                      # settings page
│   ├── options.html
│   ├── options.css
│   └── options.js
├── popup/                        # toolbar popup
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── scripts/
│   ├── check-i18n.mjs            # i18n consistency checker
│   └── package.py                # dist zip packager
├── src/
│   ├── common.js                 # pure-JS helpers (tz offset / format / storage / messaging)
│   ├── content-main.js           # MAIN-world Date/Intl spoofer (page-script engine)
│   ├── content-controller.js     # isolated-world config sync, verify relay, floating badge
│   ├── i18n.js                   # 14-language loader + manual language override
│   └── ui.css                    # shared popup/options styles
└── tools/
    ├── gen_data.py               # → data/timezones.json
    ├── gen_locales.py            # → _locales/*/messages.json
    └── make_icons.py             # → icons/
```

## License

[Apache-2.0](LICENSE). Free to use, modify and redistribute.

---

# 修改时区

[English](#change-timezone) | 免费开源（Apache-2.0）的 Chrome / Edge 时区切换扩展（Manifest V3）


## 功能特性

- **逐标签页切换时区**：点击工具栏图标，只把**当前标签页**的时区改成随机或指定的 IANA 时区，其他标签页和系统时钟不受影响。
- **双引擎修改方式**，popup 中随时切换：
  - `cdp`（浏览器时区）：基于 `chrome.debugger` + CDP `Emulation.setTimezoneOverride`，**真正**在浏览器层改变标签页时区；附加调试器期间 Chrome 会在标签页显示"正在调试"横幅。
  - `script`（页面脚本）：MAIN 世界 content script 重写页面内的 `Date` / `Intl`，轻量、无横幅，但只影响页面脚本。
  - `auto`（默认）：优先 cdp，调试器附加失败时自动回退 script。
- **即时生效验证**：每次 apply 后自动读取页面**实际读到**的时区，与你的选择比对并给出 PASS / FAIL；popup 验证面板、页面悬浮徽标、options 验证表格三处呈现。
- **386 个 IANA 时区** + 28 个常用，按区域分组，支持即时搜索。
- **随机时区**：popup 随机按钮，或快捷键 `Ctrl+Shift+Z` 对当前标签页应用。
- **收藏**：任意时区可加星收藏，收藏芯片固定在 popup 列表顶部。
- **悬浮验证徽标**：可选开关，在页面上显示"期望 / 实际"对照卡片与生效状态。
- **14 种语言**：English、简体中文、繁體中文、日本語、한국어、Español、Português (Brasil)、Français、Deutsch、Русский、Italiano、Türkçe、Bahasa Indonesia、Tiếng Việt。

## 界面截图

_待补充：popup、验证面板与页面悬浮徽标。_

## 安装（加载已解压）

1. 克隆或下载本仓库。解压后的目录名可任意（加载不强制改名；与仓库名一致只是便于对照）。
2. 打开 `chrome://extensions`（Edge 用 `edge://extensions`）。
3. 打开右上角**开发者模式**。
4. 点击**加载已解压的扩展程序**，选择 `change-timezone` 目录。
5. 固定扩展到工具栏，点击图标即可使用。

## 使用方法

1. 在要修改的标签页点击工具栏图标。
2. 选择修改方式（自动 / 浏览器时区 / 页面脚本）与时区（或点**随机**）。
3. 点**应用**，popup 会自动验证并展示结果：

   | 行 | 含义 |
   | --- | --- |
   | 实际观测 | 页面真实读到的时区（含 UTC 偏移 / 本地时间） |
   | 期望值 | 你选择的时区 |
   | 结果 | 实际观测 == 期望值 为 PASS，否则 FAIL |

4. **恢复**按钮把该标签页还原为系统默认。

**关于 cdp（浏览器时区）模式**：它从浏览器层真正改变标签页时区，页面感知彻底。调试器附加期间 Chrome 会在标签页显示"正在调试"横幅；手动关掉横幅会分离调试器，此时扩展会把该标签页标记为 *detached*（popup 会提示重新应用以恢复覆盖）。

**页面脚本模式的限制**：仅重写页面内 `Date` / `Intl`。若页面在配置写入前已加载完成，可能需要刷新（"应用后重新加载标签页"选项默认开启）。**不带显式时区**的时间字符串解析仍走真实系统时区——这是页面脚本无法完全覆盖的底层行为。要完整效果请使用 cdp 模式。

## 常见问题

**点「加载已解压」报错** —— 请确认选中的是**直接包含 `manifest.json` 的内层目录**（如 `change-timezone-main/`），而不是 zip 文件本身，也不是它的上级目录。

**标签页出现「正在调试此浏览器」横幅** —— 这是浏览器级（CDP）方式的正常现象，真正的时区覆盖靠它保持；关掉横幅会解除覆盖，重新点「应用」即可恢复。不想看到横幅，可切换到页面脚本方式。

**能改 Ctrl+Shift+Z 快捷键吗？** —— 可以：打开 `chrome://extensions/shortcuts`（Edge：`edge://extensions/shortcuts`），修改「为当前标签页应用随机时区」。

**为什么权限看起来很多？** —— `debugger` 用于实现浏览器级时区覆盖；`scripting` / `tabs` / 主机访问用于把配置写入页面并读回页面实际看到的时区。代码不含任何统计、追踪或网络请求，数据不出本机。

**页面显示的时间没变** —— 页面脚本模式下，配置写入前已加载完成的页面可能需要刷新（默认已开启「应用后重新加载标签页」）。要完全原生的效果，请使用浏览器级（CDP）方式。

## 开发与工具

三个生成器均可重复执行。本机使用的 Python 解释器（生成图标需 Pillow）位于：

```
C:/Users/Doro/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe
```

```bash
# 重新生成 data/timezones.json（仅在整理时区清单后需要）
python tools/gen_data.py

# 重新生成 icons/（16/32/48/128 PNG + 灰色 -off 变体 + icon.svg）
python tools/make_icons.py

# 重新生成 _locales/*/messages.json（14 语言）
python tools/gen_locales.py

# i18n 一致性校验（JSON 合法性、与 en 键集合一致、$ 占位符一致、
# t('key') / data-i18n="key" 引用扫描）——纯 Node，零依赖
node scripts/check-i18n.mjs

# 打包 dist/change-timezone-<version>.zip（仅运行时文件）
python scripts/package.py
```

环境要求：Python 3 + Pillow（仅图标生成需要）；Node.js（仅校验脚本需要）。无其他依赖。

### 新增一种语言

1. 在 `tools/gen_locales.py` 的 `T` 字典中加一段语言译文（复制任一段落翻译取值）。
2. 运行 `python tools/gen_locales.py`。
3. 在 `src/i18n.js` 的 `SUPPORTED` 数组加入语言代码，在 `options/options.js` 的 `LANG_NAMES` 加入本地名称。
4. 运行 `node scripts/check-i18n.mjs` 确认键集合一致。

## 目录结构

见上方英文版目录树（中英一致）：运行时文件为 `manifest.json`、`_locales/`、`background/`、`src/`、`popup/`、`options/`、`icons/`、`data/`；`tools/` 与 `scripts/` 为开发工具，`docs/`、`*.md` 等不进入分发包。

## 许可证

[Apache-2.0](LICENSE)。可自由使用、修改与再分发。
