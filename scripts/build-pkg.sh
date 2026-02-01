#!/bin/bash
# 使用 @yao-pkg/pkg 构建可执行文件

set -e

echo "=========================================="
echo "  数据可视化分析 - pkg 打包构建"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PROJECT_DIR/packages/server"
PKG_DIST_DIR="$PROJECT_DIR/pkg-dist"

if ! command -v pkg &> /dev/null; then
    echo "正在安装 @yao-pkg/pkg..."
    npm install -g @yao-pkg/pkg
fi

echo "pkg 版本: $(pkg --version)"

rm -rf "$PKG_DIST_DIR"
mkdir -p "$PKG_DIST_DIR"

echo ""
echo "1. 构建项目..."
cd "$PROJECT_DIR"
pnpm build

echo ""
echo "2. 检查静态文件..."
if [ ! -d "$SERVER_DIR/dist/public" ]; then
    echo "错误: 静态文件目录不存在!"
    exit 1
fi

echo ""
echo "3. 执行打包..."
cd "$SERVER_DIR"

export PKG_CACHE_PATH="$HOME/.pkg-cache"

echo "   打包 macOS x64..."
pkg . -t node18-macos-x64 -o "$PKG_DIST_DIR/data-vision-mac-x64" 2>&1 || true

echo "   打包 macOS arm64..."
pkg . -t node18-macos-arm64 -o "$PKG_DIST_DIR/data-vision-mac-arm64" 2>&1 || true

echo "   打包 Windows x64..."
pkg . -t node18-win-x64 -o "$PKG_DIST_DIR/data-vision-win-x64.exe" 2>&1 || true

echo "   打包 Linux x64..."
pkg . -t node18-linux-x64 -o "$PKG_DIST_DIR/data-vision-linux-x64" 2>&1 || true

echo ""
echo "4. 创建启动脚本..."

cat > "$PKG_DIST_DIR/启动应用-Mac.command" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    ./data-vision-mac-arm64
else
    ./data-vision-mac-x64
fi
EOF
chmod +x "$PKG_DIST_DIR/启动应用-Mac.command"

cat > "$PKG_DIST_DIR/启动应用-Windows.bat" << 'EOF'
@echo off
chcp 65001 >nul
cd /d "%~dp0"
data-vision-win-x64.exe
pause
EOF

cat > "$PKG_DIST_DIR/使用说明.txt" << 'EOF'
数据可视化分析应用
========================================
无需安装任何依赖，双击即可运行
访问地址: http://localhost:3456
EOF

echo ""
echo "=========================================="
echo "  打包完成! 输出目录: $PKG_DIST_DIR"
echo "=========================================="
ls -lh "$PKG_DIST_DIR"/
