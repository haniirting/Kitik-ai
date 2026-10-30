@echo off
chcp 65001 >nul
rem 1) Put your TikTok username here (without @)
set TIKTOK_USER=ТВОЙ_НИК
rem 2) AI: either run Ollama (ollama pull llama3.1), or uncomment and fill the Claude key:
rem set ANTHROPIC_API_KEY=sk-ant-...
rem set OLLAMA_MODEL=llama3.1
call npm install
node server.js
pause
