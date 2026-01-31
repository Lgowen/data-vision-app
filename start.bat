@echo off
title 数据可视化分析
echo ========================================
echo   数据可视化分析应用
echo ========================================
echo.
echo 正在启动服务...
cd /d "%~dp0"
cd packages\server
node dist\index.js
pause
