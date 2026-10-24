# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 客户报修小程序

## 简述

这是一个微信小程序，客户可以通过这个程序进行故障报修。

## 当前状态（重要）

- 项目基于 `hello-uniapp` 官方示例模板改名而来（`manifest.json` `name` = `repair_uapp`），大量示例页面仍是模板遗留：`pages/API`、`pages/component`、`pages/template`、`pages/tabBar`、`pages/extUI` 以及 `components/`、`common/` 均为示例/演示代码，不是业务代码。
- 登录页已实现并接入后端 `POST /wx/login`：点击登录先获取微信小程序 `code`，再携带账号密码执行登录，成功后将 JWT 写入 storage 的 `token` 并进入 `/pages/project/project` 项目选择占位页。报修列表、报修表单、报修详情尚未实现。
- 目前 `utils/` 下的网络、提示、存储、环境封装以及 `api/` 下的接口定义属于本项目自有代码。

## 技术栈

- uni-app，Vue 3（`manifest.json` `vueVersion: "3"`）
- 状态管理：Vuex（`store/index.js`）+ Pinia（`store/counter.js`），二者在 `main.js` 中同时注册
- 工具层使用 TypeScript（`utils/*.ts`），页面层为 `.vue`
- 目标平台：微信小程序（`manifest.json` `mp-weixin.appid` = `wxfaa4731e370dadb7`）

## 运行 / 构建 / 测试

- 无 npm 构建脚本：`package.json` 的 `dependencies` 为空，`scripts.test` 只是占位（`echo ... && exit 1`）。开发与发行均通过 HBuilderX 完成：
  - 运行：HBuilderX「运行 → 运行到小程序模拟器 → 微信开发者工具」
  - 发行：HBuilderX「发行 → 小程序-微信」
- 测试：`jest.config.js` 存在，但 `testMatch` 只匹配模板示例页（`pages/**/*test.js`），当前无业务测试，也没有可用的 `npm test` 命令。
- 构建产物在 `unpackage/dist/dev/mp-weixin`（HBuilderX 生成，勿手改）。

## 架构

### 请求层 `utils/request.ts`

所有网络请求必须走此封装（`import request from "@/utils/request"`），不要直接用 `uni.request`：

- 导出一个 `UniRequest` 单例，提供 `get/post/put/delete/all` 方法。
- `baseUrl` 来自 `utils/env.ts`；传入 `http(s)://` 绝对路径时不拼接。
- 请求拦截器：从 `utils/storage.ts` 读取 `token` 写入请求头 `Authorization: Bearer <token>`。
- 响应拦截器：成功时直接返回 `res.data`（页面可直接解构业务数据）；失败时调用 `toast` 提示。
- 内置 Loading 防抖队列：默认 `isLoading: true`，并发请求全部完成后再延迟 500ms 关闭；单请求可传 `{ isLoading: false }` 静默。
- `statusCode === 401` 时弹 `modal` 提示并 `uni.reLaunch` 到 `/pages/login/login`。

### 接口层 `api/`

- `api/auth.ts`：微信登录接口 `wxLogin`，对应后端 `POST /wx/login`。仅传 `code` 为静默登录；首次绑定或换绑需同时传 `accountName`、`accountPwd`，成功返回 JWT（`obj.sessionValue`）。

### 环境 `utils/env.ts`

根据 `uni.getAccountInfoSync().miniProgram.envVersion`（`develop`/`trial`/`release`）切换 `baseUrl`。开发环境已配置为 `http://127.0.0.1:9024/endpoint-repair`，体验版/正式版仍为 `example.com` 占位，需替换为真实接口地址。

### 存储 `utils/storage.ts`

`setStorage/getStorage/removeStorage/clearStorage` 对 `uni.*StorageSync` 的同步封装。`token` 约定存在 storage 里（供 `request.ts` 读取）。

### 配置入口

- `pages.json`：页面注册、`tabBar`、`subPackages`（`pages/API` 为子包）。新增业务页面需在此登记；首页为数组第一项。
- `manifest.json`：应用配置（appid、微信小程序 appid、`vueVersion`）。
- `main.js`：Vue3 `createApp` 工厂，注册 Vuex 与 Pinia，并 return `{ app, Vuex, Pinia }` 供 nvue 使用。
- `App.vue`：`onLaunch`/`onShow` 全局逻辑（当前含 App 端升级检查与一键登录，小程序端基本无业务逻辑）。

## 编码标准

- 网络请求使用封装好的 `./utils/request.js`（实际文件为 `utils/request.ts`）。
- 项目中的提示（toast/modal）使用 `./utils/extendApi.ts`（`toast`、`modal`）。
- 默认中文回复；代码、命令、变量名、文件路径保持英文。

## 系统描述

1. 公司各项目对应不同公司的客户，不同客户都能根据自己的项目进行报修。
   1. 一个客户对应多个项目时，登录后首先让客户选择项目。
   2. 客户登录信息由公司搜集并生成登录账号给到客户。
2. 报修需填写故障内容，可选附带照片，需留下姓名、联系方式（可从登录信息带出）。
3. 客户能看到报修列表，分为「处理中」「已完成」。
4. 点击报修列表条目可查看报修详情。

<!-- superpowers-zh:begin (do not edit between these markers) -->
# Superpowers-ZH 中文增强版

本项目已安装 superpowers-zh 技能框架（21 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 `.claude/skills/` 目录，每个 skill 有独立的 `SKILL.md` 文件。

- **brainstorming**: 在任何创造性工作之前必须使用此技能——创建功能、构建组件、添加功能或修改行为。在实现之前先探索用户意图、需求和设计。
- **chinese-code-review**: 中文 review 沟通参考——话术模板、分级标注（必须修复/建议修改/仅供参考）、国内团队常见反模式应对。仅在用户显式 /chinese-code-review 时调用，不要根据上下文自动触发。
- **chinese-commit-conventions**: 中文 commit 与 changelog 配置参考——Conventional Commits 中文适配、commitlint/husky/commitizen 中文模板、conventional-changelog 中文配置。仅在用户显式 /chinese-commit-conventions 时调用，不要根据上下文自动触发。
- **chinese-documentation**: 中文文档排版参考——中英文空格、全半角标点、术语保留、链接格式、中文文案排版指北约定。仅在用户显式 /chinese-documentation 时调用，不要根据上下文自动触发。
- **chinese-git-workflow**: 国内 Git 平台配置参考——Gitee、Coding.net、极狐 GitLab、CNB 的 SSH/HTTPS/凭据/CI 接入差异与镜像同步配置。仅在用户显式 /chinese-git-workflow 时调用，不要根据上下文自动触发。
- **diagnosing-superpowers**: 当一次 superpowers 会话出了问题、你的人类伙伴想知道原因时使用——重复劳动、无视计划、磕磕绊绊、结果质量差、某个技能没触发、"太慢了"、"为什么这么贵"、"它到底在干什么"——或者想给 superpowers 维护者整理一份 bug 报告；适用于当前会话，或按 id / 路径指定的过往会话，任何工具均可
- **dispatching-parallel-agents**: 当面对 2 个以上可以独立进行、无共享状态或顺序依赖的任务时使用
- **executing-plans**: 当你要在当前会话里亲自担任实现者执行一份实现计划时使用——你的人类伙伴选择了内联执行，或者没有可用的子智能体工具
- **finishing-a-development-branch**: 当实现完成、所有测试通过、需要决定如何集成这份工作时使用
- **mcp-builder**: 在构建 MCP 服务器或 MCP 工具时使用 —— 系统化的生产级 MCP 构建方法论，覆盖工具设计、错误处理、传输层选择与测试，让 AI 助手连接外部能力
- **receiving-code-review**: 收到代码审查反馈后、实施建议之前使用，尤其当反馈不明确或技术上有疑问时——需要技术严谨性和验证，而非敷衍附和或盲目执行
- **requesting-code-review**: 完成任务、实现重要功能或合并前使用，用于验证工作成果是否符合要求
- **subagent-driven-development**: 当在当前会话中执行包含独立任务的实现计划时使用
- **systematic-debugging**: 遇到任何 bug、测试失败或异常行为时使用，在提出修复方案之前执行
- **test-driven-development**: 在实现任何功能或修复 bug 时使用，在编写实现代码之前
- **using-git-worktrees**: 当需要开始与当前工作区隔离的功能开发，或在执行实现计划之前使用——通过原生工具或 git worktree 回退机制确保隔离工作区存在
- **using-superpowers**: 在开始任何对话时使用——确立如何查找和使用技能，要求在任何响应（包括澄清性问题）之前调用 Skill 工具
- **verification-before-completion**: 在宣称工作完成、已修复或测试通过之前使用，在提交或创建 PR 之前——必须运行验证命令并确认输出后才能声称成功；始终用证据支撑断言
- **workflow-runner**: 在 Claude Code / OpenClaw / Cursor 中直接运行 agency-orchestrator YAML 工作流——无需 API key，使用当前会话的 LLM 作为执行引擎。当用户提供 .yaml 工作流文件或要求多角色协作完成任务时触发。
- **writing-plans**: 当你有规格说明或需求用于多步骤任务时使用，在动手写代码之前
- **writing-skills**: 当创建新技能、编辑现有技能或在部署前验证技能是否有效时使用

## 如何使用

当任务匹配某个 skill 时，使用 `Skill` 工具加载对应 skill 并严格遵循其流程。绝不要用 Read 工具读取 SKILL.md 文件。

如果你认为哪怕只有 1% 的可能性某个 skill 适用于你正在做的事情，你必须调用该 skill 检查。
<!-- superpowers-zh:end -->
