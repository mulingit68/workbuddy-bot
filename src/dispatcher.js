'use strict';

/**
 * 任务分发模块（幕僚长中枢）
 *
 * 路由优先级：
 *   1. 显式指定：任务文本以 "@角色id" 开头，或调用时传入 roleId
 *   2. 关键词匹配：按角色 frontmatter 中的 keywords 计分，取最高分
 *   3. 兜底：交给幕僚长（chief-of-staff）
 *
 * 分发流程：组装（全局规则 + 角色定义 + 共享上下文 + 任务）→ 调用 LLM →
 * 产出草稿 → 写入共享上下文与会话 → 返回。
 */

const { loadRoles, loadRules } = require('./roles');
const provider = require('./provider');

class Dispatcher {
  constructor(config, contextStore, sessionManager) {
    this.config = config;
    this.context = contextStore;
    this.sessions = sessionManager;
    this.roles = loadRoles(config.rootDir);
    this.rules = loadRules(config.rootDir);
  }

  /** 路由：返回命中的角色对象 */
  route(task, roleId) {
    // 1. 显式指定
    const explicit = roleId || (task.match(/^@([\w-]+)\s*/) || [])[1];
    if (explicit) {
      const role = this.roles.find(r => r.id === explicit);
      if (!role) throw new Error(`角色不存在: ${explicit}（可用 list 命令查看全部角色）`);
      return role;
    }
    // 2. 关键词计分
    let best = null;
    let bestScore = 0;
    for (const role of this.roles) {
      const score = role.keywords.filter(k => task.includes(k)).length;
      if (score > bestScore) {
        best = role;
        bestScore = score;
      }
    }
    // 3. 兜底幕僚长
    return best || this.roles.find(r => r.id === this.config.dispatch.defaultRole);
  }

  /** 分发任务并返回 { role, draft, sessionId } */
  async dispatch(task, options = {}) {
    const role = this.route(task, options.roleId);
    const cleanTask = task.replace(/^@[\w-]+\s*/, '');

    // 会话：沿用传入的 sessionId，否则新建
    let sessionId = options.sessionId;
    if (!sessionId) {
      sessionId = this.sessions.create(cleanTask.slice(0, 30)).id;
    }
    this.sessions.append(sessionId, 'user', cleanTask);

    // 组装消息：全局规则 + 角色定义 + 共享上下文 + 会话历史 + 当前任务
    const sharedContext = JSON.stringify(this.context.get(), null, 2);
    const history = (this.sessions.get(sessionId).messages || [])
      .slice(-10)
      .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

    const messages = [
      {
        role: 'system',
        content: [
          `你是 WorkBuddy 高管团队的「${role.name}」（${role.title}）。`,
          '',
          '# 全局规则', this.rules,
          '',
          '# 角色定义', role.prompt,
          '',
          '# 共享上下文', sharedContext,
        ].join('\n'),
      },
      ...history.slice(0, -1),
      { role: 'user', content: cleanTask },
    ];

    const draft = await provider.chat(messages, this.config);

    // 记录：会话 + 共享上下文日志
    this.sessions.append(sessionId, 'assistant', draft);
    this.context.log({ type: 'dispatch', roleId: role.id, task: cleanTask, draft, sessionId });

    return { role, draft, sessionId };
  }

  /** 每日简报：汇总共享上下文中的最近记录 */
  briefing() {
    const recent = this.context.recentMessages(50).filter(m => m.type === 'dispatch');
    const byRole = {};
    for (const m of recent) {
      (byRole[m.roleId] = byRole[m.roleId] || []).push(m);
    }
    const lines = ['# WorkBuddy 每日简报', ''];
    const topN = (this.config.briefing && this.config.briefing.topDecisions) || 5;
    const roleName = id => (this.roles.find(r => r.id === id) || { name: id }).name;

    lines.push('## 各角色动态');
    if (recent.length === 0) lines.push('- 暂无记录。');
    for (const [roleId, items] of Object.entries(byRole)) {
      lines.push(`- ${roleName(roleId)}：${items.length} 项任务，最近一项「${items[items.length - 1].task.slice(0, 40)}」`);
    }
    lines.push('', `## 置顶待决策（最多 ${topN} 条）`);
    const pending = recent.filter(m => m.draft && m.draft.includes('待老板'));
    if (pending.length === 0) lines.push('- 暂无待决策事项。');
    for (const m of pending.slice(-topN)) {
      lines.push(`- [${roleName(m.roleId)}] ${m.task.slice(0, 60)}`);
    }
    return lines.join('\n');
  }
}

module.exports = { Dispatcher };
