#!/usr/bin/env bash
# WorkBuddy Bot 一键启动（Linux / macOS / Git Bash）
set -e
cd "$(dirname "$0")/.."

# 首次运行：自动生成 .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "已生成 .env，请按需填写（留空 LLM 密钥则走离线草稿模式）。"
fi

# 运行环境：默认 local，云端部署时设置 WORKBUDDY_ENV=cloud
export WORKBUDDY_ENV="${WORKBUDDY_ENV:-local}"

echo "环境: $WORKBUDDY_ENV"
node src/index.js list
echo ""
echo "快速上手："
echo "  node src/index.js dispatch \"你的任务\""
echo "  node src/index.js briefing"
