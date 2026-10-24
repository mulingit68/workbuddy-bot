'use strict';

/** 冒烟测试：离线模式下验证配置、能力注册表、调度方案与落盘全流程 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { loadConfig } = require('../src/config');
const { loadCapabilities, matchCapabilities } = require('../src/capabilities');
const { ContextStore } = require('../src/context-store');
const { SessionManager } = require('../src/session');
const { Dispatcher } = require('../src/dispatcher');

const ROOT = path.resolve(__dirname, '..');

function makeDispatcher() {
  const config = loadConfig();
  config.dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workbuddy-bot-'));
  config.llm.apiKey = ''; // 强制离线模式
  const context = new ContextStore(config.dataDir);
  const sessions = new SessionManager(config.dataDir);
  return { dispatcher: new Dispatcher(config, context, sessions), context };
}

test('配置加载：默认 local 环境', () => {
  delete process.env.WORKBUDDY_ENV;
  assert.strictEqual(loadConfig().env, 'local');
});

test('能力注册表：条目完整且含四类能力的优先级基础', () => {
  const caps = loadCapabilities(ROOT);
  assert.ok(caps.length >= 10);
  for (const c of caps) {
    assert.ok(c.id && c.type && c.name && c.provider && Array.isArray(c.keywords) && c.invoke);
    assert.ok(['skill', 'expert', 'connector', 'custom'].includes(c.type));
  }
});

test('匹配：技能优先命中与命中依据', () => {
  const caps = loadCapabilities(ROOT);
  const m1 = matchCapabilities('帮我做一份 Word 合同模板', caps);
  assert.strictEqual(m1[0].id, 'docx');
  assert.ok(m1[0].hits.length > 0);
  const m2 = matchCapabilities('分析一下股指期货行情', caps);
  assert.ok(m2.some(c => c.id === 'finance'));
});

test('调度：无命中时标记待定制开发', () => {
  const { dispatcher } = makeDispatcher();
  const plan = dispatcher.plan('量子引力波干涉仪标定');
  assert.strictEqual(plan.customNeeded, true);
  const draft = dispatcher.renderPlan('量子引力波干涉仪标定', plan);
  assert.ok(draft.includes('定制开发'));
  assert.ok(draft.includes('【草稿，待老板批准】'));
});

test('调度：命中时分派到技能并落盘', async () => {
  const { dispatcher, context } = makeDispatcher();
  const { plan, draft, sessionId } = await dispatcher.dispatch('把这份财报做成 PPT');
  assert.strictEqual(plan.customNeeded, false);
  assert.ok(plan.matches.some(m => m.id === 'pptx'));
  assert.ok(draft.includes('分派方案'));
  const logs = context.recentMessages();
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].sessionId, sessionId);
  assert.ok(logs[0].assigned.length > 0);
});

test('简报：汇总分派记录', async () => {
  const { dispatcher } = makeDispatcher();
  await dispatcher.dispatch('帮我写一份市场研究报告');
  const text = dispatcher.briefing();
  assert.ok(text.includes('每日简报'));
  assert.ok(text.includes('调度动态'));
});
