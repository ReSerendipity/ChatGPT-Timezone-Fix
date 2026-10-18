# Changelog

本文件记录本项目所有值得注意的变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

> **发布现状**：本仓当前无发布链（`main` 上无 `.github/workflows/`、无 tag、无 Release），
> 尚未建立版本化发布，故暂不设版本段与发布日期。以下条目依据提交历史标题归类回填
> （`feat→Added`、`fix→Fixed`、`refactor→Changed`），仅作变更记录，不构成已发布版本说明。

### Added

- popup 首次引导条、CDP 横幅安抚提示、Random 快捷键提示（14 语言补 3 键）
- 14 语言本地化与生成器
- popup 与设置页界面（双模式切换、随机、收藏、验证面板）
- MV3 核心——双引擎时区覆盖（CDP/页面脚本）与生效验证
- 时区数据集（386 个 IANA 时区）与应用图标生成

### Fixed

- 恢复时无条件清除时区覆盖并分离调试器（不再依赖状态记录）；CDP 附加成功后命令失败先分离再上报，避免孤儿调试器导致横幅不消失
- applyTimezone 的 CDP 分支回调未返回结果对象，auto/cdp 模式应用时区时报 Cannot read properties of undefined (reading 'effective')
