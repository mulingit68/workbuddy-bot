#!/usr/bin/env node
'use strict';

/**
 * WorkBuddy Bot 命令行入口
 *
 * 用法：
 *   node src/index.js list                        列出全部角色
 *   node src/index.js route "<任务>"              只路由不执行，查看任务归属
 *   node src/index.js dispatch "<任务>" [--role <id>] [--session <id>]
 *   node src/index.js briefing                    生成每日简报
 *   node src/index.js session list|new|show [id]  会话管理
 *   node src/index.js context get|set <k> <v>     共享上下文读写
 */

const { loadConfig } = require('./config');
const { loadRoles } = require('./roles');
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
      console.log(`WorkBuddy 高管团队（环境：${config.env}）\n`);
      for (const r of loadRoles(config.rootDir)) {
        console.log(`  ${r.id.padEnd(16)} ${r.name}（${r.title}） 汇报给: ${r.reportsTo || '-'}`);
      }
      break;
    }

    case 'route': {
      const task = args.slice(1).join(' ');
      if (!task) throw new Error('用法: route "<任务>"');
      const role = dispatcher.route(task, opts.role);
      console.log(`任务归属 → ${role.name}（${role.id}，汇报给 ${role.reportsTo || '老板'}）`);
      break;
    }

    case 'dispatch': {
      const task = args.slice(1).join(' ');
      if (!task) throw new Error('用法: dispatch "<任务>" [--role <id>] [--session <id>]');
      const { role, draft, sessionId } = await dispatcher.dispatch(task, {
        roleId: opts.role,
        sessionId: opts.session,
      });
      console.log(`已分发给：${role.name}（${role.id}）  会话：${sessionId}\n`);
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
        const value = context.get(args[2]);
        console.log(JSON.stringify(value, null, 2));
      }
      break;
    }

    default:
      console.log([
        'WorkBuddy Bot — 多角色协作高管团队',
        '',
        '命令：',
        '  list                              列出全部角色',
        '  route "<任务>"                    只路由不执行',
        '  dispatch "<任务>" [--role <id>]   分发任务并产出草稿',
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
