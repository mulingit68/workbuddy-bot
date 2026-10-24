'use strict';

/**
 * 上下文共享模块
 *
 * 所有角色共享一份持久化上下文（data/context.json）：
 *   - shared:   键值对，存放跨角色共享的事实与状态
 *   - messages: 消息日志，记录每次任务分发与草稿产出，供简报汇总
 */

const fs = require('fs');
const path = require('path');

class ContextStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'context.json');
    fs.mkdirSync(dataDir, { recursive: true });
    this.data = this._read();
  }

  _read() {
    if (!fs.existsSync(this.file)) return { shared: {}, messages: [] };
    try {
      return JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      return { shared: {}, messages: [] };
    }
  }

  _write() {
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8');
  }

  get(key) {
    return key === undefined ? this.data.shared : this.data.shared[key];
  }

  set(key, value) {
    this.data.shared[key] = value;
    this._write();
  }

  /** 追加一条消息日志：{ type, roleId, task?, draft?, sessionId?, time } */
  log(entry) {
    this.data.messages.push({ time: new Date().toISOString(), ...entry });
    this._write();
  }

  recentMessages(limit = 50) {
    return this.data.messages.slice(-limit);
  }
}

module.exports = { ContextStore };
