# 能力映射指南：新增功能如何落地

核心原则：**先查注册表，再考虑写代码**。新增任何功能，按以下决策树走一遍。

## 决策树

```
新功能需求
│
├─ 1. 查 capabilities/registry.json：是否已有现成能力覆盖？
│     ├─ 是 → 直接用，只需确认关键词能命中（必要时补充 keywords）
│     └─ 否 ↓
│
├─ 2. 查 WorkBuddy 技能/专家市场：是否有未启用的现成能力？
│     ├─ 是 → 启用后，在 registry.json 追加一条记录（skill/expert），完成
│     └─ 否 ↓
│
├─ 3. 查连接器市场：是否是外部数据/服务问题？
│     ├─ 是 → 接入连接器，在 registry.json 追加一条记录（connector），完成
│     └─ 否 ↓
│
└─ 4. 确实没有现成能力 → 定制开发
      ├─ 在 src/handlers/ 下新建处理模块（保持最小实现）
      ├─ 在 registry.json 追加一条记录（type: custom，指向 handler）
      └─ 在 README「定制开发项」一节登记原因
```

## 注册表条目格式

```json
{
  "id": "唯一标识",
  "type": "skill | expert | connector | custom",
  "name": "中文名称",
  "provider": "提供方（技能名 / 专家名 / 连接器名 / handler 文件名）",
  "keywords": ["路由命中关键词，尽量覆盖用户的自然说法"],
  "invoke": "调用方式说明（宿主内如何触发）",
  "status": "可选：disabled 表示暂未启用"
}
```

## 关键词维护要点

- 关键词决定路由命中率，**用用户的自然语言**，不用技术术语。
- 新增条目后跑一次 `node src/index.js plan "<典型任务>"` 验证命中。
- 两个能力关键词重叠导致误命中时，给更具体的能力加更长尾的关键词。

## 定制开发的退出机制

定制 handler 是临时方案：一旦 WorkBuddy 上线对应技能，应改回 `type: skill` 并删除 handler，保持「自研代码最小化」。
