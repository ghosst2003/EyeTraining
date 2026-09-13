@echo off
chcp 65001 >nul
title 眼睛训练系统 - Eye Training System

echo ========================================
echo    眼睛训练系统 - Eye Training System
echo ========================================
echo.

REM 检查 Python 是否安装
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误：未找到 Python，请先安装 Python 3
    echo 下载地址：https://www.python.org/downloads/
    pause
    exit /b 1
)

REM 检查是否在正确的目录
if not exist "index.html" (
    echo 错误：请在 EyeTraining 目录下运行此脚本
    pause
    exit /b 1
)

echo 正在启动服务器...
echo.
echo 请在浏览器中打开：http://localhost:8888
echo.
echo 按 Ctrl+C 停止服务器
echo.

REM 启动服务器
python -m http.server 8888
