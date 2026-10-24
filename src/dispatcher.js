'use strict';

/**
 * CEO 调度模块
 *
 * CEO 不执行业务，只做：接收需求 → 拆解 → 查能力注册表分派 → 汇总。
 *
 * 分派流程：
 *   1. 用注册表关键词匹配任务，得到命中能力（按 技能→专家→连接器 排序）
 *   2. 有命中：生成五段式调度方案（拆解/分派/顺序/汇总/待决策）
 *   3. 无命中：标记「待定制开发」，写明原因与最小可行方案
 *   4. 配置 LLM 时，由模型基于注册表做更细的拆解与润色；无 LLM 时用确定性模板
 */

const fs = require('fs');
const path = require('path');
const { loadCapabilities, matchCapabilities, sortByType, TYPE_LABEL } = require('./capabilities');
const provider = require('./provider');

function loadCeoPrompt(rootDir) {
  const file = path.join(rootDir, 'agents', 'ceo.md');
  const content = fs.readFileSync(file, 'utf8');
  const body = content.match(/^---[\s\S]*?---\r?\n?([\s\S]*)$/);
  return body ? body[1].trim() : content;
}

class Dispatcher {
  constructor(config, contextStore, sessionManager) {
    this.config = config;
    this.context = contextStore;
    this.sessions = sessionManager;
    this.capabilities = loadCapabilities(config.rootDir);
    this.ceoPrompt = loadCeoPrompt(config.rootDir);
  }

  /** 只出调度方案，不执行：返回 { matches, customNeeded } */
  plan(task) {
    const matches = sortByType(matchCapabilities(task, this.capabilities));
    return { matches, customNeeded: matches.length === 0 };
  }

  /** 离线/确定性调度方案模板（五段式） */
  renderPlan(task, plan) {
    const lines = ['## 任务拆解', `- ${task}`, '', '## 分派方案', '', '| 子任务 | 能力类型 | 能力名称 | 调用方式 | 命中依据 |', '|---|---|---|---|---|'];
    if (plan.customNeeded) {
      lines.push(`| ${task} | 定制开发 | 待评估 | src/handlers/（需老板批准） | 注册表无命中 |`);
    } else {
      for (const m of plan.matches) {
        lines.push(`| ${task} | ${TYPE_LABEL[m.type]} | ${m.name} | ${m.invoke} | 关键词: ${m.hits.join('、')} |`);
      }
    }
    lines.push(
      '',
      '## 执行顺序',
      plan.customNeeded ? '- 先由老板确认是否定制开发。' : '- 各能力产出独立，可并行；汇总由 CEO 完成。',
      '',
      '## 汇总方式',
      '- 各能力产出写入共享上下文，CEO 合并为最终交付物草稿。',
      '',
      '## 待老板决策',
      plan.customNeeded ? '- 是否批准定制开发？（现成能力均不覆盖）' : '- 是否按上述分派方案执行？',
      '',
      '【草稿，待老板批准】'
    );
    return lines.join('\n');
  }

  /** 调度任务：生成方案草稿并落盘，返回 { plan, draft, sessionId } */
  async dispatch(task, options = {}) {
    const plan = this.plan(task);

    let sessionId = options.sessionId;
    if (!sessionId) {
      sessionId = this.sessions.create(task.slice(0, 30)).id;
    }
    this.sessions.append(sessionId, 'user', task);

    let draft;
    if (this.config.llm.apiKey) {
      // 有 LLM：让模型基于注册表与 CEO 定义输出调度方案
      const registryDigest = this.capabilities
        .map(c => `- [${TYPE_LABEL[c.type]}] ${c.name}（${c.provider}）关键词: ${c.keywords.join('、')}；调用: ${c.invoke}`)
        .join('\n');
      const messages = [
        {
          role: 'system',
          content: [
            this.ceoPrompt,
            '',
            '# 可复用能力注册表（只允许从这里分派）',
            registryDigest,
            '',
            '# 共享上下文',
            JSON.stringify(this.context.get(), null, 2),
          ].join('\n'),
        },
        { role: 'user', content: task },
      ];
      draft = await provider.chat(messages, this.config);
    } else {
      draft = this.renderPlan(task, plan);
    }

    this.sessions.append(sessionId, 'assistant', draft);
    this.context.log({
      type: 'dispatch',
      task,
      assigned: plan.matches.map(m => ({ id: m.id, type: m.type, name: m.name })),
      customNeeded: plan.customNeeded,
      draft,
      sessionId,
    });
    return { plan, draft, sessionId };
  }

  /** 每日简报：汇总共享上下文中的调度记录 */
  briefing() {
    const recent = this.context.recentMessages(50).filter(m => m.type === 'dispatch');
    const lines = ['# WorkBuddy 每日简报', '', '## 调度动态'];
    if (recent.length === 0) lines.push('- 暂无记录。');
    const byCap = {};
    for (const m of recent) {
      for (const a of m.assigned || []) {
        byCap[a.name] = (byCap[a.name] || 0) + 1;
      }
    }
    for (const [name, count] of Object.entries(byCap)) {
      lines.push(`- ${name}：被分派 ${count} 次`);
    }
    const customs = recent.filter(m => m.customNeeded);
    lines.push('', '## 待决策');
    if (customs.length === 0 && recent.length === 0) lines.push('- 暂无待决策事项。');
    for (const m of recent.slice(-5)) {
      lines.push(`- 「${m.task.slice(0, 50)}」${m.customNeeded ? '（待定制开发评估）' : ''}`);
    }
    return lines.join('\n');
  }
}

module.exports = { Dispatcher };
