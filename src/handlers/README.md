# src/handlers/ — 定制开发兜底目录

只有当 `capabilities/registry.json` 中的技能、专家、连接器**三类能力都无法满足**需求，
且经老板批准后，才在这里新建处理模块。

## 使用约定

1. 每个 handler 一个文件，导出 `async function handle(task, context)`。
2. 同时在 `capabilities/registry.json` 登记一条 `type: "custom"` 的记录，
   `provider` 填本文件名，让 CEO 能路由到它。
3. 在根 README 的「定制开发项」一节登记原因。
4. 一旦 WorkBuddy 上线对应的现成能力，立即改回 `type: "skill"` 并删除本 handler。
