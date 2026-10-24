'use strict';

/** 冒烟测试：离线模式下验证配置加载、角色加载、路由与分发全流程 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { loadConfig } = require('../src/config');
const { loadRoles } = require('../src/roles');
const { ContextStore } = require('../src/context-store');
const { SessionManager } = require('../src/session');
const { Dispatcher } = require('../src/dispatcher');

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
  const config = loadConfig();
  assert.strictEqual(config.env, 'local');
  assert.ok(config.llm);
});

test('角色加载：包含幕僚长且字段完整', () => {
  const roles = loadRoles(path.resolve(__dirname, '..'));
  assert.ok(roles.length >= 5);
  const cos = roles.find(r => r.id === 'chief-of-staff');
  assert.ok(cos && cos.name && cos.prompt.length > 0);
});

test('路由：关键词命中与兜底', () => {
  const { dispatcher } = makeDispatcher();
  assert.strictEqual(dispatcher.route('帮我看看这个 bug 的代码').id, 'cto');
  assert.strictEqual(dispatcher.route('本月预算超了吗').id, 'cfo');
  assert.strictEqual(dispatcher.route('随便聊聊').id, 'chief-of-staff');
  assert.strictEqual(dispatcher.route('', 'cmo').id, 'cmo');
});

test('分发：离线草稿 + 上下文与会话落盘', async () => {
  const { dispatcher, context } = makeDispatcher();
  const { role, draft, sessionId } = await dispatcher.dispatch('做一期视频号选题规划');
  assert.strictEqual(role.id, 'cmo');
  assert.ok(draft.includes('【草稿，待老板批准】'));
  const logs = context.recentMessages();
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].sessionId, sessionId);
});

test('简报：包含角色动态', async () => {
  const { dispatcher } = makeDispatcher();
  await dispatcher.dispatch('整理一下代码结构');
  const text = dispatcher.briefing();
  assert.ok(text.includes('每日简报'));
  assert.ok(text.includes('技术负责人'));
});
