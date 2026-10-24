'use strict';

/**
 * 会话管理模块
 *
 * 每个会话是 data/sessions/<id>.json 一个独立文件：
 *   { id, title, createdAt, updatedAt, messages: [{ role, content, time }] }
 * 用于隔离不同工作线索的对话历史，互不串扰。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SessionManager {
  constructor(dataDir) {
    this.dir = path.join(dataDir, 'sessions');
    fs.mkdirSync(this.dir, { recursive: true });
  }

  _file(id) {
    return path.join(this.dir, `${id}.json`);
  }

  create(title = '') {
    const id = crypto.randomBytes(4).toString('hex');
    const now = new Date().toISOString();
    const session = { id, title, createdAt: now, updatedAt: now, messages: [] };
    fs.writeFileSync(this._file(id), JSON.stringify(session, null, 2), 'utf8');
    return session;
  }

  list() {
    return fs.readdirSync(this.dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const s = JSON.parse(fs.readFileSync(path.join(this.dir, f), 'utf8'));
        return { id: s.id, title: s.title, updatedAt: s.updatedAt, messageCount: s.messages.length };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  get(id) {
    if (!fs.existsSync(this._file(id))) return null;
    return JSON.parse(fs.readFileSync(this._file(id), 'utf8'));
  }

  append(id, role, content) {
    const session = this.get(id);
    if (!session) throw new Error(`会话不存在: ${id}`);
    session.messages.push({ role, content, time: new Date().toISOString() });
    session.updatedAt = new Date().toISOString();
    fs.writeFileSync(this._file(id), JSON.stringify(session, null, 2), 'utf8');
    return session;
  }
}

module.exports = { SessionManager };
