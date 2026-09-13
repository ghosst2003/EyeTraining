#!/bin/bash

# 眼睛训练系统 - 启动脚本 (macOS / Linux)

echo "========================================"
echo "   眼睛训练系统 - Eye Training System"
echo "========================================"
echo ""

# 检查 Python 是否安装
if ! command -v python3 &> /dev/null; then
    echo "错误：未找到 Python 3，请先安装 Python 3"
    echo "下载地址：https://www.python.org/downloads/"
    exit 1
fi

# 检查是否在正确的目录
if [ ! -f "index.html" ]; then
    echo "错误：请在 EyeTraining 目录下运行此脚本"
    exit 1
fi

# 查找可用端口
PORT=8888
while lsof -i :$PORT &> /dev/null; do
    PORT=$((PORT + 1))
done

echo "正在启动服务器..."
echo "端口：$PORT"
echo ""
echo "请在浏览器中打开：http://localhost:$PORT"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

# 启动服务器
python3 -m http.server $PORT
