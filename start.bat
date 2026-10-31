@echo off
chcp 65001 >nul
rem 1) Put your TikTok username here (without @)
set TIKTOK_USER=ТВОЙ_НИК
rem 2) AI: Ollama model name (run once: ollama pull qwen2.5:7b). Or uncomment and fill the Claude key:
rem set ANTHROPIC_API_KEY=sk-ant-...
set OLLAMA_MODEL=qwen2.5:7b
call npm install
node server.js
pause
