#!/bin/bash
# 完整测试脚本 - 验证所有构建产物
# 测试 Go 版本和 pkg 版本的构建和运行

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试结果
TESTS_PASSED=0
TESTS_FAILED=0
TEST_RESULTS=""

# 打印函数
print_header() {
    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
}

print_step() {
    echo -e "${YELLOW}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    TEST_RESULTS="$TEST_RESULTS\n${GREEN}✓${NC} $1"
}

print_fail() {
    echo -e "${RED}✗ $1${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    TEST_RESULTS="$TEST_RESULTS\n${RED}✗${NC} $1"
}

print_info() {
    echo -e "  $1"
}

# 等待服务启动
wait_for_server() {
    local port=$1
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "http://localhost:$port/api/health" > /dev/null 2>&1; then
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    return 1
}

# 停止指定端口的进程
kill_port() {
    local port=$1
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    sleep 1
}

# 测试服务功能
test_server() {
    local name=$1
    local port=3456
    
    print_step "测试 $name 服务功能..."
    
    # 测试健康检查
    local health=$(curl -s "http://localhost:$port/api/health")
    if echo "$health" | grep -q '"status":"ok"'; then
        print_success "$name - 健康检查 API 正常"
    else
        print_fail "$name - 健康检查 API 失败"
        return 1
    fi
    
    # 测试首页 HTML
    local html=$(curl -s "http://localhost:$port/")
    if echo "$html" | grep -q '<!DOCTYPE html>'; then
        print_success "$name - 首页 HTML 正常返回"
    else
        print_fail "$name - 首页 HTML 返回异常"
        return 1
    fi
    
    # 测试静态资源
    local js_status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/assets/index-DeZCzIh8.js")
    if [ "$js_status" = "200" ]; then
        print_success "$name - JS 静态资源正常"
    else
        print_fail "$name - JS 静态资源异常 (HTTP $js_status)"
    fi
    
    local css_status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/assets/index-Bb-XEh43.css")
    if [ "$css_status" = "200" ]; then
        print_success "$name - CSS 静态资源正常"
    else
        print_fail "$name - CSS 静态资源异常 (HTTP $css_status)"
    fi
    
    # 测试数据集 API
    local datasets=$(curl -s "http://localhost:$port/api/datasets")
    if echo "$datasets" | grep -qE '^\['; then
        print_success "$name - 数据集列表 API 正常"
    else
        print_fail "$name - 数据集列表 API 失败"
    fi
    
    # 测试文件上传
    echo "name,value,date" > /tmp/test-upload.csv
    echo "A,100,2024-01-01" >> /tmp/test-upload.csv
    echo "B,200,2024-01-02" >> /tmp/test-upload.csv
    
    local upload=$(curl -s -F "file=@/tmp/test-upload.csv" "http://localhost:$port/api/upload")
    if echo "$upload" | grep -q '"success":true'; then
        print_success "$name - 文件上传 API 正常"
        
        # 提取 datasetId 并测试计算
        local dataset_id=$(echo "$upload" | grep -o '"datasetId":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$dataset_id" ]; then
            local calc=$(curl -s -X POST "http://localhost:$port/api/calculate" \
                -H "Content-Type: application/json" \
                -d "{\"datasetId\":\"$dataset_id\",\"formula\":\"sum\",\"columnX\":\"name\",\"columnY\":\"value\"}")
            if echo "$calc" | grep -q '"success":true'; then
                print_success "$name - 计算 API 正常 (sum=300)"
            else
                print_fail "$name - 计算 API 失败"
            fi
        fi
    else
        print_fail "$name - 文件上传 API 失败"
    fi
    
    rm -f /tmp/test-upload.csv
    return 0
}

# 主脚本开始
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

print_header "数据可视化分析 - 完整测试"
echo "项目目录: $PROJECT_DIR"
echo "测试时间: $(date)"

# 确保端口空闲
kill_port 3456

#===========================================
# 1. 环境检查
#===========================================
print_header "1. 环境检查"

# 检查 Node.js
if command -v node &> /dev/null; then
    print_success "Node.js 已安装: $(node -v)"
else
    print_fail "Node.js 未安装"
fi

# 检查 pnpm
if command -v pnpm &> /dev/null; then
    print_success "pnpm 已安装: $(pnpm -v)"
else
    print_fail "pnpm 未安装"
fi

# 检查 Go
if command -v go &> /dev/null; then
    print_success "Go 已安装: $(go version | cut -d' ' -f3)"
elif [ -d "$HOME/go-sdk/go/bin" ]; then
    export PATH="$HOME/go-sdk/go/bin:$PATH"
    print_success "Go 已安装 (本地): $(go version | cut -d' ' -f3)"
else
    print_fail "Go 未安装"
fi

# 检查 pkg
if command -v pkg &> /dev/null; then
    print_success "pkg 已安装: $(pkg -v)"
else
    print_info "pkg 未安装，将在测试时自动安装"
fi

#===========================================
# 2. 测试 Go 版本构建
#===========================================
print_header "2. 测试 Go 版本构建"

cd "$PROJECT_DIR"

print_step "执行 Go 构建脚本..."
if bash scripts/build-go.sh > /tmp/build-go.log 2>&1; then
    print_success "Go 版本构建成功"
    
    # 检查产物
    GO_DIST="$PROJECT_DIR/go-dist"
    if [ -f "$GO_DIST/data-vision-mac-arm64" ]; then
        SIZE=$(ls -lh "$GO_DIST/data-vision-mac-arm64" | awk '{print $5}')
        print_success "Go Mac ARM64 产物存在 ($SIZE)"
    else
        print_fail "Go Mac ARM64 产物不存在"
    fi
    
    if [ -f "$GO_DIST/data-vision-windows-amd64.exe" ]; then
        SIZE=$(ls -lh "$GO_DIST/data-vision-windows-amd64.exe" | awk '{print $5}')
        print_success "Go Windows 产物存在 ($SIZE)"
    else
        print_fail "Go Windows 产物不存在"
    fi
else
    print_fail "Go 版本构建失败"
    echo "查看日志: cat /tmp/build-go.log"
fi

#===========================================
# 3. 测试 Go 版本运行
#===========================================
print_header "3. 测试 Go 版本运行"

GO_BINARY="$PROJECT_DIR/go-dist/data-vision-mac-arm64"
if [ "$(uname -m)" != "arm64" ]; then
    GO_BINARY="$PROJECT_DIR/go-dist/data-vision-mac-amd64"
fi

if [ -f "$GO_BINARY" ]; then
    print_step "启动 Go 服务..."
    kill_port 3456
    
    "$GO_BINARY" > /tmp/go-server.log 2>&1 &
    GO_PID=$!
    
    if wait_for_server 3456; then
        print_success "Go 服务启动成功 (PID: $GO_PID)"
        
        # 测试服务功能
        test_server "Go 版本"
        
        # 停止服务
        kill $GO_PID 2>/dev/null || true
        kill_port 3456
        print_info "Go 服务已停止"
    else
        print_fail "Go 服务启动超时"
        kill $GO_PID 2>/dev/null || true
    fi
else
    print_fail "Go 可执行文件不存在: $GO_BINARY"
fi

#===========================================
# 4. 测试 pkg 版本构建
#===========================================
print_header "4. 测试 pkg 版本构建"

cd "$PROJECT_DIR"

print_step "执行 pkg 构建脚本..."
if bash scripts/build-pkg.sh > /tmp/build-pkg.log 2>&1; then
    print_success "pkg 版本构建成功"
    
    # 检查产物
    PKG_DIST="$PROJECT_DIR/pkg-dist"
    if [ -f "$PKG_DIST/data-vision-mac-arm64" ]; then
        SIZE=$(ls -lh "$PKG_DIST/data-vision-mac-arm64" | awk '{print $5}')
        print_success "pkg Mac ARM64 产物存在 ($SIZE)"
    else
        print_fail "pkg Mac ARM64 产物不存在"
    fi
    
    if [ -f "$PKG_DIST/data-vision-win-x64.exe" ]; then
        SIZE=$(ls -lh "$PKG_DIST/data-vision-win-x64.exe" | awk '{print $5}')
        print_success "pkg Windows 产物存在 ($SIZE)"
    else
        print_fail "pkg Windows 产物不存在"
    fi
else
    print_fail "pkg 版本构建失败"
    echo "查看日志: cat /tmp/build-pkg.log"
fi

#===========================================
# 5. 测试 pkg 版本运行
#===========================================
print_header "5. 测试 pkg 版本运行"

PKG_BINARY="$PROJECT_DIR/pkg-dist/data-vision-mac-arm64"
if [ "$(uname -m)" != "arm64" ]; then
    PKG_BINARY="$PROJECT_DIR/pkg-dist/data-vision-mac-x64"
fi

if [ -f "$PKG_BINARY" ]; then
    print_step "启动 pkg 服务..."
    kill_port 3456
    
    "$PKG_BINARY" > /tmp/pkg-server.log 2>&1 &
    PKG_PID=$!
    
    if wait_for_server 3456; then
        print_success "pkg 服务启动成功 (PID: $PKG_PID)"
        
        # 测试服务功能
        test_server "pkg 版本"
        
        # 停止服务
        kill $PKG_PID 2>/dev/null || true
        kill_port 3456
        print_info "pkg 服务已停止"
    else
        print_fail "pkg 服务启动超时"
        kill $PKG_PID 2>/dev/null || true
    fi
else
    print_fail "pkg 可执行文件不存在: $PKG_BINARY"
fi

#===========================================
# 6. 测试报告
#===========================================
print_header "测试报告"

echo ""
echo -e "测试结果汇总:"
echo -e "$TEST_RESULTS"
echo ""
echo "════════════════════════════════════════"
echo -e "  ${GREEN}通过: $TESTS_PASSED${NC}  |  ${RED}失败: $TESTS_FAILED${NC}"
echo "════════════════════════════════════════"

# 清理
kill_port 3456

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 所有测试通过！${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}⚠️  有 $TESTS_FAILED 个测试失败${NC}"
    exit 1
fi
