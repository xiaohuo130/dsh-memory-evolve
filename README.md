# dsh-memory-evolve

> **让 DeepSeek Harness 里的 AI 拥有跨会话的长期记忆、自我进化的技能库、待办管理，以及多 agent 协作能力。**

[简体中文](./README.md) · [English](./README.en.md) · [使用指南](./docs/使用指南.md) · [详细功能说明](./README-详细说明.md) · [更新日志](./docs/CHANGELOG.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](./package.json)

---

## 这是什么

`dsh-memory-evolve` 是 [DeepSeek Harness](https://github.com/deepseek-ai/dsh) 的一个全功能插件（Host + Web 客户端）。它给 DSH 补上了三样东西：

1. **记忆** —— 跨会话、分层、可归档的长期记忆；
2. **进化** —— 把经验沉淀成技能，越用越顺手；
3. **协作** —— 会话广播、COI 调度、多个外部 AI CLI 的派单。

插件默认只启用最基础的能力，其余在 **Memory Evolve 设置** 里按需打开，不占用模型的工具清单。

![记忆 Tab](docs/记忆tab.png)

## 功能

| 模块 | 能力 |
| --- | --- |
| **分层记忆** | 用户档案 / 全局事实 / 项目关键记忆 / 项目日志 / 每日日志；项目记忆可按 git 分支生效；超预算自动降级为目录行 |
| **自我进化** | 从会话中沉淀经验、自动生成技能；技能可管理、可浏览、可导出 |
| **待办** | 项目/工作/生活/每日四轨待办，支持四象限、截止日期、状态流转 |
| **COI 调度** | 统一派单 kimi / codex / grok / hermes 等外部 AI CLI，任务状态可视化 |
| **会话广播** | DSH 会话之间互发消息，支持房间、在线状态与图片附件 |
| **无限画板** | 把文件/文本/图片/音视频集中到一块可平移缩放的画布上 |
| **提示词库** | 提示词注入与管理，按场景启用 |
| **记忆同步** | 多台电脑通过 git 共享项目记忆（冲突合并、身份隔离） |
| **WebUI** | 设置页、记忆队列、通知铃铛、书签、会话评审、Mermaid 渲染等 |

其余截图见 [使用指南](./docs/使用指南.md)。

## 安装

```sh
# 从 GitHub 安装
dsh plugin --profile web add github:xiaohuo130/dsh-memory-evolve

# 或本地开发
git clone https://github.com/xiaohuo130/dsh-memory-evolve
dsh plugin --profile web add ./dsh-memory-evolve
```

bundle 在 **启动时** 装配，安装后需要重启 DSH，然后刷新页面。

> 插件以 DSH 标准安装方式（profile 的 `node_modules`）为准，**不要**手动改 profile 的 `package.json` 或 `cordis.patch.yml`。

## 快速开始

1. 打开任意会话，页面会多出 **记忆 / 技能 / 待办 / COI 调度 / 会话广播 / 画板 / 提示词 / 记忆同步** 等标签；
2. 进入 **Memory Evolve 设置**，按需打开对应能力；
3. 正常对话即可——每回合结束会把进展写进项目日志与今日日志；
4. 想让它记住重要结论时说「**记一下：……**」，写入项目关键记忆前会先等你确认。

完整工作流见 [使用指南](./docs/使用指南.md)。

## 构建

`lib/client.js` 是 **预构建产物**，直接安装即可用，不需要自己构建。

需要修改前端源码时：

```sh
# 构建依赖 DSH 源码 checkout 里的 esbuild
export DSH_SOURCE=/path/to/dsh-checkout
node scripts/build.mjs      # 产出 lib/client.js
```

构建脚本会自动把旧的 `lib/client.js` 备份为 `lib/client.js.bak-build-<时间戳>`。

## 测试

```sh
node --test 'tests/*.test.js'   # Node >= 20
```

测试覆盖记忆存储、同步、会话广播、COI 调度、待办、技能、书签、通知、WebUI API 等模块。

## 目录结构

```
.
├── lib/                 # Host 运行时 + 预构建的 client bundle
├── src/client/          # Web 客户端源码（TS/TSX）
├── scripts/             # 构建与 worker 脚本
├── skills/              # 插件自带的技能模板
├── tests/               # node:test 测试套件
├── docs/                # 使用指南、详细说明、截图、更新日志
└── vendor/              # mermaid 渲染引擎（按需从 /memory-evolve/mermaid/ 提供）
```

## 兼容性

- 需要 DSH 提供 `tools` / `systemPrompt` / Web 客户端运行时（0.1.x / 0.2.x 均验证过）。
- 纯 ESM，Host 侧**零运行时依赖**；前端依赖打入 `lib/client.js`。
- Node.js >= 20。

## 文档

- [使用指南（中文）](./docs/使用指南.md)
- [Usage guide (English)](./docs/USAGE.en.md)
- [详细功能说明](./README-详细说明.md)
- [记忆同步](./docs/记忆同步.md)
- [COI 调度](./docs/COI-调度.md)
- [更新日志](./docs/CHANGELOG.md)

## 贡献

欢迎 issue 与 PR。提交前请确保 `node --test 'tests/*.test.js'` 全部通过；改动前端时同时提交 `src/` 与更新后的 `lib/client.js`。

## 许可

[MIT](./LICENSE)
