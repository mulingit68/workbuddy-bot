'use strict';

/**
 * 能力注册表模块
 *
 * 加载 capabilities/registry.json，提供关键词匹配。
 * CEO 的所有分派决策只查注册表，不硬编码任何能力。
 */

const fs = require('fs');
const path = require('path');

function loadCapabilities(rootDir) {
  const file = path.join(rootDir, 'capabilities', 'registry.json');
  const registry = JSON.parse(fs.readFileSync(file, 'utf8'));
  return registry.capabilities.filter(c => c.status !== 'disabled');
}

/**
 * 关键词匹配：返回按命中数降序的能力列表，每项附命中依据。
 * 命中 0 个关键词的能力不返回。
 */
function matchCapabilities(task, capabilities) {
  return capabilities
    .map(cap => {
      const hits = cap.keywords.filter(k => task.toLowerCase().includes(k.toLowerCase()));
      return { ...cap, hits, score: hits.length };
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** 按类型分组的展示顺序：技能 → 专家 → 连接器 → 定制开发 */
const TYPE_ORDER = ['skill', 'expert', 'connector', 'custom'];
const TYPE_LABEL = { skill: '技能', expert: '专家', connector: '连接器', custom: '定制开发' };

function sortByType(items) {
  return [...items].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
}

module.exports = { loadCapabilities, matchCapabilities, sortByType, TYPE_LABEL };
