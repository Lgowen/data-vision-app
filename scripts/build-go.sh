#!/bin/bash
# Go 服务端跨平台编译脚本

set -e

echo "=========================================="
echo "  数据可视化分析 - Go 服务端编译"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
GO_SERVER_DIR="$PROJECT_DIR/packages/go-server"
DIST_DIR="$PROJECT_DIR/go-dist"

if ! command -v go &> /dev/null; then
    if [ -d "$HOME/go-sdk/go/bin" ]; then
        export PATH="$HOME/go-sdk/go/bin:$PATH"
    else
        echo "错误: 未找到 Go 编译器，请先安装 Go: https://go.dev/dl/"
        exit 1
    fi
fi

echo "Go 版本: $(go version)"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

echo ""
echo "1. 构建前端..."
cd "$PROJECT_DIR"
if command -v pnpm &> /dev/null; then
    pnpm build:web
else
    npm run build:web
fi

echo ""
echo "2. 复制前端文件..."
rm -rf "$GO_SERVER_DIR/public"
mkdir -p "$GO_SERVER_DIR/public"
cp -r "$PROJECT_DIR/packages/server/dist/public/"* "$GO_SERVER_DIR/public/"

cd "$GO_SERVER_DIR"

echo ""
echo "3. 下载 Go 依赖..."
go mod tidy

echo ""
echo "4. 编译各平台版本..."

echo "   - macOS ARM64 (Apple Silicon)..."
GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o "$DIST_DIR/data-vision-mac-arm64" .

echo "   - macOS AMD64 (Intel)..."
GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o "$DIST_DIR/data-vision-mac-amd64" .

echo "   - Windows AMD64..."
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o "$DIST_DIR/data-vision-windows-amd64.exe" .

echo "   - Linux AMD64..."
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o "$DIST_DIR/data-vision-linux-amd64" .

echo "   - Linux ARM64..."
GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o "$DIST_DIR/data-vision-linux-arm64" .

echo ""
echo "5. 创建启动脚本..."

cat > "$DIST_DIR/启动应用-Mac.command" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    ./data-vision-mac-arm64
else
    ./data-vision-mac-amd64
fi
EOF
chmod +x "$DIST_DIR/启动应用-Mac.command"

cat > "$DIST_DIR/启动应用-Windows.bat" << 'EOF'
@echo off
chcp 65001 >nul
cd /d "%~dp0"
data-vision-windows-amd64.exe
pause
EOF

cat > "$DIST_DIR/启动应用-Linux.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    ./data-vision-linux-arm64
else
    ./data-vision-linux-amd64
fi
EOF
chmod +x "$DIST_DIR/启动应用-Linux.sh"

cat > "$DIST_DIR/使用说明.txt" << 'EOF'
数据可视化分析应用 - 使用说明
========================================

【无需安装任何依赖】

【启动方式】
- Windows: 双击 data-vision-windows-amd64.exe
- Mac: 双击 启动应用-Mac.command
- Linux: ./启动应用-Linux.sh

【访问地址】
http://localhost:3456
EOF

echo ""
echo "=========================================="
echo "  编译完成! 输出目录: $DIST_DIR"
echo "=========================================="
ls -lh "$DIST_DIR"/data-vision-*
