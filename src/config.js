'use strict';

/**
 * 配置加载模块
 *
 * 四层合并（后者覆盖前者）：
 *   config/default.json  <  config/{env}.json  <  .env  <  环境变量
 *
 * env 由 WORKBUDDY_ENV 决定，取值 cloud | local，默认 local。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function readJson(file) {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(base, override) {
  const out = { ...base };
  for (const [k, v] of Object.entries(override || {})) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out;
}

/** 解析 .env 文件（简单的 KEY=VALUE 格式，支持 # 注释） */
function loadDotEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return env;
}

function loadConfig() {
  // .env 先载入进程环境（不覆盖已存在的环境变量）
  const dotEnv = loadDotEnv(path.join(ROOT, '.env'));
  for (const [k, v] of Object.entries(dotEnv)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }

  const env = process.env.WORKBUDDY_ENV || 'local';
  const merged = deepMerge(
    readJson(path.join(ROOT, 'config', 'default.json')),
    readJson(path.join(ROOT, 'config', `${env}.json`))
  );

  // 环境变量最高优先级
  merged.env = env;
  if (process.env.WORKBUDDY_DATA_DIR) merged.dataDir = process.env.WORKBUDDY_DATA_DIR;
  merged.llm = merged.llm || {};
  if (process.env.WORKBUDDY_LLM_BASE_URL) merged.llm.baseUrl = process.env.WORKBUDDY_LLM_BASE_URL;
  if (process.env.WORKBUDDY_LLM_API_KEY) merged.llm.apiKey = process.env.WORKBUDDY_LLM_API_KEY;
  if (process.env.WORKBUDDY_LLM_MODEL) merged.llm.model = process.env.WORKBUDDY_LLM_MODEL;

  merged.rootDir = ROOT;
  merged.dataDir = path.resolve(ROOT, merged.dataDir || 'data');
  return merged;
}

module.exports = { loadConfig };
