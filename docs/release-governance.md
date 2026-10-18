# 发布 / 回滚规范（ChatGPT-Timezone-Fix）

> **来源与权威**：公共条款见 `ReSerendipity/.github` 的 `REPOSITORY_GUIDELINES.md` §10（发布 / 分发统一规范）。
> 本文件是 `ChatGPT-Timezone-Fix` 仓的本地化发布文档，只记录**本仓特有**内容，**不重写、不抵触 §10 的公共条款**。
> **本仓现状（2026-10-18 核实）**：`main` 上**无 `.github/workflows/`、无 tag / Release**；**`CHANGELOG.md` 已于 2026-10-18 补建**——即**本仓当前无发布链**。下文凡涉及远端流程处均已如实标注现状，未虚构任何 workflow 或产物。

---

## 0. 远端优先（根原则，不可改写）

发布链的构建、打包、扫描、上传、推送**全部在 GitHub Actions 远端完成**；本地只做三件事：改版本位、落 CHANGELOG、`git tag` + `git push`。本地不执行打包 / 镜像构建 / 发布上传。

> **本仓现状偏差**：本仓唯一的打包入口 `scripts/package.py` 目前**在本机运行**（`README.md`「开发与工具」一节即如此记载），尚未迁到远端 Actions。此偏差须按 §10.1 收敛（见 §4 待收敛项）。

## 1. 版本号规范

- 遵循 **SemVer** `MAJOR.MINOR.PATCH`；预发布用 `-alpha.N` / `-beta.N` / `-rc.N`。
- **唯一权威版本位**：`manifest.json` 的顶层 `version` 字段（当前 `1.0.0`）。
- 必须同步的其它版本位：**无**。本仓无 `package.json` / `pyproject.toml`（已核实）；`README.md`、`data/timezones.json`、`_locales/**`、`tools/**` 等均未内嵌版本串。
- 版本位漂移校验入口：**暂无**（本仓无 `tests/` 目录、无 CI）。如需自动化钉住，**待定（负责人 + 触发条件）**——负责人 = 仓库所有者；触发条件 = 本仓引入 CI 或将版本声明扩展到多处时。
- 自动化方式：**手动 tag（人工）**。本仓未接入 release-please，当前亦无任何 tag / Release 实践（`gh api …/tags`、`…/releases` 均为空）。
- 版本号进产物：`scripts/package.py` 从 `manifest.json` 读取 `version`，据此命名产物 `dist/chatgpt-timezone-fix-<version>.zip`。

## 2. CHANGELOG 管理

- 遵循 **Keep a Changelog**：`Added / Changed / Fixed / Deprecated / Removed / Security`。
- 每次合并 `main` 在 `[Unreleased]` 追加；type 映射 `feat→Added`、`fix→Fixed`、`refactor→Changed`。
- 发版时 `[Unreleased]` → `[VERSION] - YYYY-MM-DD`。
- **本仓现状**：仓库根**已建立 `CHANGELOG.md`**（2026-10-18 补建，遵循 Keep a Changelog）。上列口径为对齐 §10.2 的目标状态；此后每次合并 `main` 在 `[Unreleased]` 追加、发版时落版本段。

## 3. 发布流程（远端）

> **本仓现状**：**无 `.github/workflows/` 目录**（`gh api …/contents/.github/workflows` 返 404），即**本仓当前无发布链**。下列为 §10 要求的**目标流程**；落地前第 4 步无对应实现。

**目标流程（对齐 §10.2，待远端发布链就位后生效）**

1. 确认 `[Unreleased]` 条目完整（依赖 §2 的 CHANGELOG，已建立）
2. 同步版本位（本仓即 `manifest.json` 的 `version`，见 §1）
3. 本地打 tag 并推送：`git tag v<X.Y.Z>` → `git push origin v<X.Y.Z>`
4. 远端凭 `push: tags: v*` 触发发布链构建产物（**本仓待建**；当前无 `release.yml` 等任何 workflow）
5. 远端建 **draft Release** 并挂资产 → 人工审核后 `published`
6. 盯到终态：`gh run list` 确认绿；红了当场修或 revert 止损

**当前过渡做法（仅本地自测，不等于发布）**：本机 `python scripts/package.py` 生成 `dist/chatgpt-timezone-fix-<version>.zip`，供自测与「加载已解压」安装。该产物**不构成正式发布**，且与 §10.1「本地不执行打包」相抵触，须在发布链就位后停用本地打包。

## 4. 分发产物与完整性

| 产物 | 构建位置 | 标签 / 命名 | 完整性手段 |
|---|---|---|---|
| 浏览器扩展 zip（MV3） | **当前在本机**（`scripts/package.py`）；目标为**远端** | `chatgpt-timezone-fix-<version>.zip`（文件名内嵌 `manifest.json` 版本；tag 用 `v<X.Y.Z>`） | `SHA256SUMS.txt`（Release 资产，§10.1） |

- 产物为**纯静态扩展包**，仅含运行时文件（`manifest.json`、`_locales/`、`background/`、`src/`、`popup/`、`options/`、`icons/`、`data/`）；`tools/`、`scripts/`、`docs/`、`*.md` 一律不进包。
- `dist/`、`*.zip`、`*.crx`、`*.pem` 已在 `.gitignore` 忽略，产物不入库。
- 容器镜像 / Python 包 / npm 包 / 桌面壳（Tauri ed25519）签名：**均不适用**——本仓为浏览器扩展，非上述任一形态，故 §10.3 的镜像、Trivy、`provenance`/`sbom` 条款对本仓不适用。
- **不使用 GPG 分离签名**（2026-10-18 裁决，§10.1 / §10.6）。
- **待收敛项**：把打包动作从本机迁至远端 Actions（远端优先），并使 Release 资产附 `SHA256SUMS.txt`。

## 5. 回滚

- **判定**（满足任一即触发）：**待定（负责人 + 触发条件）**——本仓为本地运行的浏览器扩展，无运行手册 / 监控，无经验值可援引，故不设编造阈值。负责人 = 仓库所有者；触发条件 = 出现「应用后页面时区未变 / 验证面板 FAIL 且影响面大」等确定信号后再定阈值。
- **执行**：`git revert <bad-commit>`（保历史、可再 forward）；本次发布为纯客户端静态产物，**无服务端配置可回滚**；已发布的不可变产物按上一版 tag 重推。
- **破坏性动作**：重指向 / 删除 tag、移动任何远端 ref → **须仓库所有者单独授权**（`push: tags` 触发的发布链在移动已发布 tag 后会当场重跑发布，DraftPeek 历史上因此产出过混年代资产）。
- **回滚后验证**：**待定（负责人 + 触发条件）**——现无自动化 smoke；当前可用的人工验证为「加载已解压 + popup 生效验证面板看 PASS/FAIL」，自动化入口待发布链建立后补。

## 6. SLA / 错误预算

- 本仓为**浏览器内本地运行**的扩展，**无服务端运行面**，传统服务可用性 SLA（如 99.5%/月）**不适用**。
- 如需定义面向发布节奏的错误预算，**待定（负责人 + 触发条件）**——负责人 = 仓库所有者；触发条件 = 本仓建立正式发布链与版本节奏后。

## 7. 发布前检查清单

- [ ] 版本位同步：`manifest.json` 的 `version` 为本次目标版本（见 §1；本仓无其它版本位）
- [ ] CHANGELOG `[Unreleased]` 已改版本 + 日期（**依赖 §2 的 CHANGELOG，已建立**）
- [ ] i18n 一致性校验通过：`node scripts/check-i18n.mjs`（退出码 0；本仓无单元测试框架）
- [ ] lint / format：**不适用**（本仓无 lint / format 配置）
- [ ] 镜像类仓项（Trivy 阻断、`.trivyignore.yaml`、`provenance` + `sbom`）：**不适用**
- [ ] **本地未产出任何发布交付物**（全部远端构建）——**当前不满足**：本仓打包仍在本地进行，属 §10.1 待收敛偏差

---

## 差异点采集清单（本单已逐项替换）

| 占位符 | 采集来源 | 本仓取值 |
|---|---|---|
| 版本位文件与字段 | 仓内版本声明 | `manifest.json` 顶层 `version`（当前 `1.0.0`） |
| 其它需同步版本位 | 版本串扫描 | 无（无 `package.json` / `pyproject.toml`；README 等未内嵌版本串） |
| 版本一致性校验入口 | `tests/**` | 无（本仓无 `tests/`、无 CI） |
| 自动化方式 | `.github/workflows/` | 手动 tag（人工）；无 release-please |
| 发布 workflow 文件名 | `.github/workflows/` | 无——本仓无 `.github/workflows/` |
| 产物形态与标签规则 | 构建 workflow | 浏览器扩展 zip `chatgpt-timezone-fix-<version>.zip`；tag `v<X.Y.Z>` |
| 完整性手段 | Release 资产清单 | `SHA256SUMS.txt`（目标口径）；无 GPG |
| 回滚判定阈值 | 运行手册 / 监控 | 待定（负责人 + 触发条件） |
| 回滚后验证命令 | `tests/smoke` | 待定（负责人 + 触发条件）；现为人工 popup PASS/FAIL |
| 技术栈 | `package.json` / `pyproject.toml` / 静态站 | Chrome/Edge MV3 浏览器扩展（JS；Python/Node 仅开发工具） |
| 部署目标 | `deploy/` / Pages workflow | 使用者「加载已解压」本地安装；无 Pages、无远端部署 |

## 禁止事项

- 不得重写 §10 的公共条款（远端优先、tag 驱动、版本位一致、不可变标签、扫描阻断、无 GPG）。
- 不得引入 `latest` 作发布基线；不得保留或新建 GPG 签名流程。
- 不得留空占位符，不得编造阈值。
