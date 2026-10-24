@echo off
REM WorkBuddy Bot 一键启动（Windows）
cd /d "%~dp0\.."

REM 首次运行：自动生成 .env
if not exist .env (
  copy .env.example .env >nul
  echo 已生成 .env，请按需填写（留空 LLM 密钥则走离线草稿模式）。
)

REM 运行环境：默认 local，云端部署时设置 WORKBUDDY_ENV=cloud
if "%WORKBUDDY_ENV%"=="" set WORKBUDDY_ENV=local

echo 环境: %WORKBUDDY_ENV%
node src\index.js list
echo.
echo 快速上手：
echo   node src\index.js dispatch "你的任务"
echo   node src\index.js briefing
