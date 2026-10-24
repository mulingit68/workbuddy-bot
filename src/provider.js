'use strict';

/**
 * LLM 提供方模块
 *
 * - 配置了 WORKBUDDY_LLM_API_KEY：调用 OpenAI 兼容的 /chat/completions 接口
 *   （云端注入密钥，或本地指向 Ollama 等兼容端点）。
 * - 未配置密钥：离线草稿模式，不发起任何网络请求，输出结构化草稿骨架，
 *   保证零依赖环境下所有流程可运行、可测试。
 */

/** 调用 OpenAI 兼容接口，返回助手文本 */
async function chat(messages, config) {
  const { baseUrl, apiKey, model } = config.llm;
  if (!apiKey) return offlineDraft(messages);

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) {
    throw new Error(`LLM 请求失败: HTTP ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

/** 离线草稿模式：不调用外部模型，产出结构化草稿骨架 */
function offlineDraft(messages) {
  const last = messages.filter(m => m.role === 'user').pop();
  const task = last ? last.content : '';
  return [
    '（离线草稿模式：未配置 LLM 密钥，以下为结构化草稿骨架）',
    '',
    `## 任务理解\n${task}`,
    '',
    '## 初步方案\n- 待补充：配置 LLM 后此处将输出完整方案。',
    '',
    '## 待老板决策\n- 是否按上述方向推进？',
    '',
    '【草稿，待老板批准】',
  ].join('\n');
}

module.exports = { chat };
