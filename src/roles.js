'use strict';

/**
 * 角色加载模块
 *
 * 从 agents/ 目录读取 Markdown 角色定义文件，
 * 解析 frontmatter（id / name / title / reports_to / keywords）与正文 prompt。
 */

const fs = require('fs');
const path = require('path');

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    }
    meta[m[1]] = value;
  }
  return { meta, body: match[2].trim() };
}

function loadRoles(rootDir) {
  const dir = path.join(rootDir, 'agents');
  const roles = [];
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
    const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (!meta.id) continue;
    roles.push({
      id: meta.id,
      name: meta.name || meta.id,
      title: meta.title || '',
      reportsTo: meta.reports_to || '',
      keywords: Array.isArray(meta.keywords) ? meta.keywords : [],
      prompt: body,
      file,
    });
  }
  return roles;
}

function loadRules(rootDir) {
  const file = path.join(rootDir, 'guides', 'rules.md');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

module.exports = { loadRoles, loadRules };
