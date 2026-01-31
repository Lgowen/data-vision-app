#!/bin/bash
# 创建便携式分发包

set -e

echo "=========================================="
echo "  创建数据可视化分析便携包"
echo "=========================================="

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/portable-dist"

# 清理并创建分发目录
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

echo "1. 构建项目..."
cd "$PROJECT_DIR"
pnpm build

echo "2. 复制服务端文件..."
mkdir -p "$DIST_DIR/server"
cp -r packages/server/dist/* "$DIST_DIR/server/"

echo "3. 创建启动脚本..."

# Mac 启动脚本
cat > "$DIST_DIR/启动应用-Mac.command" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
echo "========================================"
echo "  数据可视化分析应用"
echo "========================================"
echo ""
echo "正在启动服务..."
echo "请在浏览器中访问: http://localhost:3456"
echo ""
node server/index.js
EOF
chmod +x "$DIST_DIR/启动应用-Mac.command"

# Windows 启动脚本
cat > "$DIST_DIR/启动应用-Windows.bat" << 'EOF'
@echo off
chcp 65001 >nul
title 数据可视化分析
echo ========================================
echo   数据可视化分析应用
echo ========================================
echo.
echo 正在启动服务...
echo 请在浏览器中访问: http://localhost:3456
echo.
cd /d "%~dp0"
node server\index.js
pause
EOF

echo "4. 创建说明文件..."
cat > "$DIST_DIR/使用说明.txt" << 'EOF'
数据可视化分析应用 - 使用说明
========================================

【前置要求】
请先安装 Node.js 18 或更高版本
下载地址: https://nodejs.org/

【启动方式】
- Windows 用户: 双击 "启动应用-Windows.bat"
- Mac 用户: 双击 "启动应用-Mac.command"

【访问地址】
启动后在浏览器中打开: http://localhost:3456

【功能说明】
1. 数据上传: 支持 CSV、Excel 格式
2. 图表分析: 柱状图、折线图、饼图、面积图
3. 数据对比: 多数据集对比分析
4. 时间聚合: 按日/周/月/年聚合

【常见问题】
Q: 启动失败提示 "node 不是内部命令"
A: 请先安装 Node.js，安装后重启电脑

Q: 端口被占用
A: 关闭其他占用 3456 端口的程序，或修改 server/index.js 中的端口号
EOF

echo ""
echo "=========================================="
echo "  便携包创建完成!"
echo "  位置: $DIST_DIR"
echo "=========================================="
echo ""
echo "分发给用户时，请确保他们已安装 Node.js"
