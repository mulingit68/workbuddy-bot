#!/usr/bin/env node
'use strict';

/**
 * WorkBuddy Bot 命令行入口（CEO 调度架构）
 *
 * 用法：
 *   node src/index.js list                        列出可复用能力注册表
 *   node src/index.js plan "<任务>"               只看调度方案（不记录）
 *   node src/index.js dispatch "<任务>" [--session <id>]   调度并记录
 *   node src/index.js briefing                    每日简报
 *   node src/index.js session list|new|show [id]  会话管理
 *   node src/index.js context get|set <k> <v>     共享上下文读写
 */

const { loadConfig } = require('./config');
const { loadCapabilities, sortByType, TYPE_LABEL } = require('./capabilities');
const { ContextStore } = require('./context-store');
const { SessionManager } = require('./session');
const { Dispatcher } = require('./dispatcher');

function parseArgs(argv) {
  const args = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      opts[argv[i].slice(2)] = argv[i + 1];
      i++;
    } else {
      args.push(argv[i]);
    }
  }
  return { args, opts };
}

async function main() {
  const { args, opts } = parseArgs(process.argv.slice(2));
  const command = args[0] || 'help';

  const config = loadConfig();
  const context = new ContextStore(config.dataDir);
  const sessions = new SessionManager(config.dataDir);
  const dispatcher = new Dispatcher(config, context, sessions);

  switch (command) {
    case 'list': {
      const caps = sortByType(loadCapabilities(config.rootDir));
      console.log(`WorkBuddy 可复用能力注册表（环境：${config.env}，共 ${caps.length} 项）\n`);
      let lastType = '';
      for (const c of caps) {
        if (c.type !== lastType) {
          console.log(`【${TYPE_LABEL[c.type]}】`);
          lastType = c.type;
        }
        console.log(`  ${c.id.padEnd(20)} ${c.name}  ←  ${c.provider}`);
      }
      console.log('\n新增能力 = 在 capabilities/registry.json 追加一条记录，详见 guides/capability-mapping.md');
      break;
    }

    case 'plan': {
      const task = args.slice(1).join(' ');
      if (!task) throw new Error('用法: plan "<任务>"');
      const plan = dispatcher.plan(task);
      console.log(dispatcher.renderPlan(task, plan));
      break;
    }

    case 'dispatch': {
      const task = args.slice(1).join(' ');
      if (!task) throw new Error('用法: dispatch "<任务>" [--session <id>]');
      const { plan, draft, sessionId } = await dispatcher.dispatch(task, { sessionId: opts.session });
      const target = plan.customNeeded
        ? '定制开发（待评估）'
        : plan.matches.map(m => `${m.name}`).join('、');
      console.log(`CEO 分派 → ${target}  会话：${sessionId}\n`);
      console.log(draft);
      break;
    }

    case 'briefing': {
      console.log(dispatcher.briefing());
      break;
    }

    case 'session': {
      const sub = args[1] || 'list';
      if (sub === 'new') {
        const s = sessions.create(args.slice(2).join(' '));
        console.log(`新会话：${s.id}${s.title ? `（${s.title}）` : ''}`);
      } else if (sub === 'show') {
        const s = sessions.get(args[2]);
        if (!s) throw new Error(`会话不存在: ${args[2]}`);
        for (const m of s.messages) console.log(`[${m.time}] ${m.role}: ${m.content.slice(0, 200)}\n`);
      } else {
        console.log('会话列表：');
        for (const s of sessions.list()) {
          console.log(`  ${s.id}  ${s.updatedAt}  ${s.messageCount} 条  ${s.title}`);
        }
      }
      break;
    }

    case 'context': {
      const sub = args[1] || 'get';
      if (sub === 'set') {
        context.set(args[2], args.slice(3).join(' '));
        console.log(`已写入共享上下文：${args[2]}`);
      } else {
        console.log(JSON.stringify(context.get(args[2]), null, 2));
      }
      break;
    }

    default:
      console.log([
        'WorkBuddy Bot — CEO 调度 + 现成能力复用',
        '',
        '命令：',
        '  list                              列出可复用能力注册表',
        '  plan "<任务>"                     只看调度方案（不记录）',
        '  dispatch "<任务>" [--session id]  调度并产出方案草稿',
        '  briefing                          每日简报',
        '  session list|new|show [id]        会话管理',
        '  context get|set <键> <值>         共享上下文读写',
      ].join('\n'));
  }
}

main().catch(err => {
  console.error(`错误: ${err.message}`);
  process.exit(1);
});
