# WorkBuddy Bot — 多角色协作高管团队机器人

WorkBuddy Bot 是一套可运行的「AI 高管团队」：以**幕僚长**为中枢，下设技术、财务、市场等负责人与项目负责人。老板只需下达任务，幕僚长自动路由给唯一负责人，产出**草稿**供批准后执行。

设计参考 [grokbot-executive-team](https://github.com/meir-bot/grokbot-executive-team) 的组织模式，并工程化为独立可运行的 Node.js 项目。

## 核心机制

| 机制 | 实现 |
|---|---|
| 角色定义 | `agents/*.md`，Markdown + frontmatter（id / 名称 / 汇报关系 / 路由关键词） |
| 任务分发 | 幕僚长中枢路由：显式 `@角色` → 关键词计分 → 兜底幕僚长 |
| 上下文共享 | `data/context.json`：共享键值 + 全量消息日志，供简报汇总 |
| 会话管理 | `data/sessions/<id>.json`：独立会话文件，不同工作线索互不串扰 |

**安全底线**：草稿优先。发送、支付、发布等不可逆操作必须经老板明确批准。

## 组织架构

```
老板
└── 幕僚长（chief-of-staff）—— 路由任务、每日简报
    ├── 技术负责人（cto）—— 产品与技术方案
    ├── 财务负责人（cfo）—— 成本拆分、月度费用报告
    ├── 市场负责人（cmo）—— 内容选题、投放草案
    └── 项目负责人 × N（project-ceo，多项目模式）
```

## 安装步骤

要求 Node.js ≥ 18（推荐 22）。**零第三方运行时依赖**，无需 `npm install`。

```bash
git clone https://github.com/<你的用户名>/workbuddy-bot.git
cd workbuddy-bot

# 一键启动（自动从 .env.example 生成 .env）
scripts/start.sh        # Linux / macOS / Git Bash
scripts\start.bat       # Windows
```

## 配置说明

配置按四层合并，后者覆盖前者：

`config/default.json` < `config/{env}.json` < `.env` < 环境变量

运行环境由 `WORKBUDDY_ENV` 切换：`local`（本地，默认）/ `cloud`（WorkBuddy 云端）。

| 配置项 | 说明 | 默认值 |
|---|---|---|
| `WORKBUDDY_ENV` | 运行环境：`cloud` / `local` | `local` |
| `WORKBUDDY_DATA_DIR` | 数据目录（上下文与会话） | `data` |
| `WORKBUDDY_LLM_BASE_URL` | OpenAI 兼容接口地址 | 见 `config/{env}.json` |
| `WORKBUDDY_LLM_API_KEY` | LLM 密钥；**留空即离线草稿模式** | 空 |
| `WORKBUDDY_LLM_MODEL` | 模型名 | `gpt-4o-mini` |

- **云端（cloud）**：密钥只允许通过平台环境变量注入，禁止写入配置文件。
- **本地（local）**：`config/local.json` 默认指向本机 OpenAI 兼容端点（如 Ollama）；不配密钥也能全流程运行（离线草稿模式）。
- 可复制 `.env.example` 为 `.env` 填写；`.env` 已被 `.gitignore` 排除。

## 使用示例

```bash
# 查看团队
node src/index.js list

# 只路由不执行，看任务归谁
node src/index.js route "本月预算超了吗"
# → 任务归属 → 财务负责人（cfo）

# 分发任务，产出草稿
node src/index.js dispatch "做一期视频号选题规划"
node src/index.js dispatch "重构登录模块" --role cto

# 在既有会话中追问（上下文连续）
node src/index.js dispatch "再补充预算估算" --session <会话id>

# 每日简报（汇总各角色动态与待决策事项）
node src/index.js briefing

# 会话与共享上下文管理
node src/index.js session list
node src/index.js context set 当前重点项目 "视频号冷启动"
```

## 目录结构

```
workbuddy-bot/
├── agents/            # 角色定义（Markdown + frontmatter）
├── config/            # default / cloud / local 三层配置
├── guides/            # 全局规则（rules）与例行任务（routines）
├── src/
│   ├── index.js         # 命令行入口
│   ├── config.js        # 配置加载（四层合并 + 环境隔离）
│   ├── roles.js         # 角色加载
│   ├── dispatcher.js    # 任务分发（幕僚长中枢路由）
│   ├── context-store.js # 上下文共享
│   ├── session.js       # 会话管理
│   └── provider.js      # LLM 接入（OpenAI 兼容 / 离线草稿模式）
├── scripts/           # 一键启动脚本（.sh / .bat）
├── test/              # 冒烟测试（node --test）
├── .env.example       # 环境变量示例（复制为 .env 使用）
└── package.json
```

## 依赖说明

无任何第三方运行时依赖，仅使用 Node.js 内置模块（`fs`/`path`/`crypto`/`fetch`）。测试使用内置 `node --test`，无需额外安装。

## 常见问题

**Q: 不配置 LLM 密钥能用吗？**
能。进入离线草稿模式：不发起任何网络请求，路由、会话、上下文、简报全流程可用，产出结构化草稿骨架。配置密钥后自动切换为真实模型输出。

**Q: 如何新增一个角色？**
在 `agents/` 下新建 Markdown 文件，frontmatter 写明 `id`、`name`、`reports_to`、`keywords`，正文写职责即可，无需改代码。

**Q: 如何切换云端/本地？**
设置 `WORKBUDDY_ENV=cloud` 或 `local`，对应配置在 `config/cloud.json` / `config/local.json`，密钥一律走环境变量。

**Q: 如何开启每日简报例行任务？**
用系统定时能力（cron / Windows 任务计划 / WorkBuddy 自动化）定时执行 `node src/index.js briefing`，详见 `guides/routines.md`。

## 许可证

MIT
