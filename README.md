# WorkBuddy Bot — CEO 调度 + 现成能力复用

WorkBuddy Bot 是一个**调度型机器人**：唯一的角色是 CEO（总调度），不亲自做业务，只做「接收需求 → 拆解任务 → 分派给 WorkBuddy 现成技能/专家/连接器 → 汇总结果」。

**核心理念：复用优先，不造轮子。** 业务功能尽量通过配置 WorkBuddy 已有的技能和专家实现；只有当现成能力确实无法满足时，才定制开发（且需老板批准、登记在案）。

## 架构

```
老板
└── CEO（总调度，agents/ceo.md）
    ├── 技能（capabilities/registry.json 中 type=skill）    ← 优先
    ├── 专家（type=expert）                                  ← 其次
    ├── 连接器（type=connector）                             ← 外部数据/服务
    └── 定制 handler（src/handlers/）                        ← 兜底，登记在案
```

## 核心模块

| 模块 | 职责 |
|---|---|
| `agents/ceo.md` | CEO 调度逻辑定义：四步流程、分派优先级、五段式输出格式、红线 |
| `capabilities/registry.json` | 可复用能力注册表：全部技能/专家/连接器的清单、关键词与调用方式 |
| `src/capabilities.js` | 注册表加载与关键词匹配（命中依据可解释） |
| `src/dispatcher.js` | CEO 调度：拆解 → 查注册表分派 → 生成方案草稿 → 落盘 |
| `src/context-store.js` | 上下文共享：`data/context.json`，分派记录供汇总与简报 |
| `src/session.js` | 会话管理：独立会话文件，支持追问 |
| `src/provider.js` | LLM 接入（可选）：有密钥时由模型做细粒度拆解，无密钥走确定性模板 |
| `guides/capability-mapping.md` | 新增功能如何映射到现有能力的决策树 |

## 安装

要求 Node.js ≥ 18（推荐 22）。**零第三方运行时依赖**，无需 `npm install`。

```bash
git clone https://github.com/mulingit68/workbuddy-bot.git
cd workbuddy-bot
scripts/start.sh        # Linux / macOS / Git Bash
scripts\start.bat       # Windows
```

## 配置

四层合并，后者覆盖前者：`config/default.json` < `config/{env}.json` < `.env` < 环境变量。运行环境由 `WORKBUDDY_ENV` 切换：`local`（默认）/ `cloud`（WorkBuddy 云端）。

| 配置项 | 说明 | 默认值 |
|---|---|---|
| `WORKBUDDY_ENV` | 运行环境：`cloud` / `local` | `local` |
| `WORKBUDDY_DATA_DIR` | 数据目录 | `data` |
| `WORKBUDDY_LLM_API_KEY` | LLM 密钥；**留空即离线模式**（确定性调度模板） | 空 |
| `WORKBUDDY_LLM_BASE_URL` / `WORKBUDDY_LLM_MODEL` | OpenAI 兼容接口 | 见 `config/{env}.json` |

- **云端**：密钥只允许通过平台环境变量注入，禁止写入配置文件。
- **本地**：默认指向本机 OpenAI 兼容端点（如 Ollama）；不配密钥也能全流程运行。
- 可复制 `.env.example` 为 `.env`（已被 `.gitignore` 排除）。

## 使用示例

```bash
# 查看可复用能力清单（技能/专家/连接器分组展示）
node src/index.js list

# 只看调度方案，不记录
node src/index.js plan "帮我做一份市场调研报告"

# 调度并产出方案草稿
node src/index.js dispatch "把销售数据做成 Excel 汇总表，再写一份 Word 分析报告"

# 在既有会话中追问
node src/index.js dispatch "报告里加一节竞品对比" --session <会话id>

# 每日简报（汇总分派动态与待决策事项）
node src/index.js briefing
```

输出示例（五段式方案草稿）：

```
CEO 分派 → Word 文档生成与美化、从零生成 Excel 工作簿

## 分派方案
| 子任务 | 能力类型 | 能力名称 | 调用方式 | 命中依据 |
| ... | 技能 | Word 文档生成与美化 | Skill: workbuddy-docx | 关键词: word、报告 |
...
【草稿，待老板批准】
```

## 新增功能如何落地

**先查注册表，再考虑写代码。** 完整决策树见 `guides/capability-mapping.md`：

1. 注册表已有能力 → 直接用（必要时补关键词）
2. WorkBuddy 技能/专家市场有现成的 → 启用后在注册表追加一条记录
3. 是外部数据/服务问题 → 接入连接器并登记
4. 以上都不行 → 才在 `src/handlers/` 定制开发，登记 `type: custom` 并在下方清单备案

### 定制开发项

当前：**无**。

## 目录结构

```
workbuddy-bot/
├── agents/ceo.md        # CEO 调度逻辑定义（唯一角色）
├── capabilities/
│   └── registry.json    # 可复用能力注册表（技能/专家/连接器）
├── config/              # default / cloud / local 三层配置
├── guides/              # 全局规则 / 能力映射指南 / 例行任务
├── src/
│   ├── index.js           # 命令行入口
│   ├── config.js          # 配置加载与环境隔离
│   ├── capabilities.js    # 注册表加载与匹配
│   ├── dispatcher.js      # CEO 调度（拆解/分派/汇总）
│   ├── context-store.js   # 上下文共享
│   ├── session.js         # 会话管理
│   ├── provider.js        # LLM 接入（可选）
│   └── handlers/          # 定制开发兜底（登记在案才可用）
├── scripts/             # 一键启动脚本（.sh / .bat）
├── test/                # 冒烟测试（node --test）
└── .env.example         # 环境变量示例
```

## 依赖说明

无任何第三方运行时依赖，仅使用 Node.js 内置模块（`fs`/`path`/`crypto`/`fetch`）。测试使用内置 `node --test`。

**重要边界**：`invoke` 字段中的 Skill / Agent / 连接器调用需在 WorkBuddy 宿主环境内真实触发；纯 CLI 环境下调度产出为「执行计划草稿」，用于审阅与确认。

## 常见问题

**Q: 不配 LLM 密钥能用吗？**
能。离线模式用确定性模板输出五段式调度方案，注册表匹配、会话、上下文、简报全流程可用。配密钥后由模型做更细的拆解。

**Q: 如何新增一个可复用能力？**
在 `capabilities/registry.json` 追加一条记录（id/type/name/provider/keywords/invoke），无需改代码。跑 `node src/index.js plan "<典型任务>"` 验证命中。

**Q: 什么时候允许写代码？**
仅当技能、专家、连接器三类都确认无法满足，且老板批准后，才在 `src/handlers/` 定制开发并登记。

**Q: 如何切换云端/本地？**
设置 `WORKBUDDY_ENV=cloud` 或 `local`；密钥一律走环境变量。

## 许可证

MIT
