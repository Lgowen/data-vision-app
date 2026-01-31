#!/bin/bash
# 使用 Node.js 原生 SEA (Single Executable Applications) 构建可执行文件
# 需要 Node.js 20+ 版本

set -e

echo "=========================================="
echo "  Node.js SEA 单可执行文件构建"
echo "=========================================="

# 检查 Node.js 版本
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "错误: 需要 Node.js 20 或更高版本"
    echo "当前版本: $(node -v)"
    echo ""
    echo "请运行: nvm install 20 && nvm use 20"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PROJECT_DIR/packages/server"
SEA_DIR="$PROJECT_DIR/sea-dist"

# 清理并创建输出目录
rm -rf "$SEA_DIR"
mkdir -p "$SEA_DIR"

echo "1. 构建项目..."
cd "$PROJECT_DIR"
pnpm build

echo "2. 创建 SEA 入口文件..."
cd "$SEA_DIR"

# 读取静态文件并生成内联代码
echo "   读取静态文件..."
node << 'NODE_SCRIPT'
const fs = require('fs');
const path = require('path');

const publicDir = '../packages/server/dist/public';
const staticFiles = {};

function readDirRecursive(dir, base = '') {
    if (!fs.existsSync(dir)) {
        console.log('警告: 目录不存在:', dir);
        return;
    }
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const relativePath = path.join(base, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            readDirRecursive(fullPath, relativePath);
        } else {
            const content = fs.readFileSync(fullPath);
            staticFiles[relativePath.replace(/\\/g, '/')] = content.toString('base64');
        }
    }
}

readDirRecursive(publicDir);
console.log('   静态文件数量:', Object.keys(staticFiles).length);

// 写入 JSON 供后续使用
fs.writeFileSync('static-files.json', JSON.stringify(staticFiles));
NODE_SCRIPT

# 创建入口文件
STATIC_JSON=$(cat static-files.json)

cat > sea-entry.js << ENTRY_EOF
// SEA 入口文件 - 自动生成
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { URL } = require('url');
const { createReadStream, createWriteStream } = require('fs');

// 内联的静态文件 (base64)
const STATIC_FILES = $STATIC_JSON;

// MIME 类型映射
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

// 创建临时目录
const tempDir = path.join(os.tmpdir(), 'data-vision-' + process.pid);
const uploadDir = path.join(tempDir, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

// 清理函数
const cleanup = () => {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch(e) {}
};
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

// 数据存储
const datasets = new Map();

// 简单的 CSV 解析器
function parseCSV(content) {
    const lines = content.split(/\\r?\\n/).filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"\$/g, ''));
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => {
            v = v.trim().replace(/^"|"\$/g, '');
            const num = Number(v);
            return isNaN(num) ? v : num;
        });
        const row = {};
        headers.forEach((h, idx) => { row[h] = values[idx]; });
        rows.push(row);
    }
    
    return { headers, rows };
}

// 解析 multipart form data
function parseMultipart(buffer, boundary) {
    const parts = [];
    const boundaryBuffer = Buffer.from('--' + boundary);
    let start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length + 2;
    
    while (start < buffer.length) {
        const end = buffer.indexOf(boundaryBuffer, start);
        if (end === -1) break;
        
        const part = buffer.slice(start, end - 2);
        const headerEnd = part.indexOf('\\r\\n\\r\\n');
        if (headerEnd === -1) { start = end + boundaryBuffer.length + 2; continue; }
        
        const headers = part.slice(0, headerEnd).toString();
        const content = part.slice(headerEnd + 4);
        
        const nameMatch = headers.match(/name="([^"]+)"/);
        const filenameMatch = headers.match(/filename="([^"]+)"/);
        
        if (nameMatch) {
            parts.push({
                name: nameMatch[1],
                filename: filenameMatch ? filenameMatch[1] : null,
                content: content
            });
        }
        
        start = end + boundaryBuffer.length + 2;
    }
    
    return parts;
}

// HTTP 服务器
const PORT = process.env.PORT || 3456;

const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }
    
    // API 路由
    if (pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    }
    
    if (pathname === '/api/upload' && req.method === 'POST') {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            try {
                const buffer = Buffer.concat(chunks);
                const contentType = req.headers['content-type'] || '';
                const boundaryMatch = contentType.match(/boundary=(.+)/);
                
                if (!boundaryMatch) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: '无效的请求格式' }));
                }
                
                const parts = parseMultipart(buffer, boundaryMatch[1]);
                const filePart = parts.find(p => p.filename);
                
                if (!filePart) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: '请选择要上传的文件' }));
                }
                
                const ext = path.extname(filePart.filename).toLowerCase();
                if (!['.csv', '.xlsx', '.xls'].includes(ext)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: '只支持 CSV、XLSX、XLS 格式' }));
                }
                
                let parsedData;
                if (ext === '.csv') {
                    parsedData = parseCSV(filePart.content.toString('utf-8'));
                } else {
                    // Excel 文件需要 xlsx 库，这里简化处理
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'SEA 模式暂不支持 Excel，请使用 CSV 格式' }));
                }
                
                const datasetId = Date.now().toString();
                datasets.set(datasetId, {
                    ...parsedData,
                    fileName: filePart.filename,
                    uploadTime: new Date().toISOString()
                });
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    datasetId,
                    data: { ...parsedData, fileName: filePart.filename, uploadTime: new Date().toISOString() }
                }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '文件解析失败: ' + error.message }));
            }
        });
        return;
    }
    
    if (pathname === '/api/datasets' && req.method === 'GET') {
        const list = Array.from(datasets.entries()).map(([id, data]) => ({
            id, fileName: data.fileName, uploadTime: data.uploadTime,
            rowCount: data.rows.length, headers: data.headers
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(list));
    }
    
    if (pathname.startsWith('/api/datasets/') && req.method === 'GET') {
        const id = pathname.split('/')[3];
        const dataset = datasets.get(id);
        if (!dataset) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: '数据集不存在' }));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(dataset));
    }
    
    if (pathname.startsWith('/api/datasets/') && req.method === 'DELETE') {
        const id = pathname.split('/')[3];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: datasets.delete(id) }));
    }
    
    if (pathname === '/api/calculate' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { datasetId, formula, columnX, columnY } = JSON.parse(body);
                const dataset = datasets.get(datasetId);
                if (!dataset) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: '数据集不存在' }));
                }
                
                const rows = dataset.rows;
                const yValues = rows.map(r => Number(r[columnY]) || 0);
                let result;
                
                switch (formula) {
                    case 'sum': result = { type: 'single', data: yValues.reduce((a, b) => a + b, 0) }; break;
                    case 'average': result = { type: 'single', data: yValues.reduce((a, b) => a + b, 0) / yValues.length }; break;
                    case 'max': result = { type: 'single', data: Math.max(...yValues) }; break;
                    case 'min': result = { type: 'single', data: Math.min(...yValues) }; break;
                    case 'groupSum': {
                        const grouped = {};
                        rows.forEach(row => { const key = String(row[columnX]); grouped[key] = (grouped[key] || 0) + (Number(row[columnY]) || 0); });
                        result = { type: 'grouped', data: Object.entries(grouped).map(([name, value]) => ({ name, value })) };
                        break;
                    }
                    case 'trend': result = { type: 'trend', data: rows.map(row => ({ x: row[columnX], y: Number(row[columnY]) || 0 })) }; break;
                    case 'compare': result = { type: 'compare', data: rows.map(row => ({ category: row[columnX], value: Number(row[columnY]) || 0 })) }; break;
                    default: result = { type: 'raw', data: rows };
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, result }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '计算失败' }));
            }
        });
        return;
    }
    
    if (pathname === '/api/aggregate' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { datasetId, dateColumn, valueColumn, period } = JSON.parse(body);
                const dataset = datasets.get(datasetId);
                if (!dataset) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: '数据集不存在' }));
                }
                
                const grouped = {};
                dataset.rows.forEach(row => {
                    const dateValue = row[dateColumn];
                    if (!dateValue) return;
                    const date = new Date(String(dateValue));
                    if (isNaN(date.getTime())) return;
                    
                    let key;
                    switch (period) {
                        case 'day': key = date.toISOString().split('T')[0]; break;
                        case 'month': key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0'); break;
                        case 'year': key = String(date.getFullYear()); break;
                        default: key = date.toISOString().split('T')[0];
                    }
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(Number(row[valueColumn]) || 0);
                });
                
                const data = Object.entries(grouped).map(([period, values]) => ({ period, value: values.reduce((a, b) => a + b, 0) })).sort((a, b) => a.period.localeCompare(b.period));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, result: { data } }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '聚合计算失败' }));
            }
        });
        return;
    }
    
    if (pathname === '/api/compare-datasets' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { datasetIds, valueColumn, labelColumn } = JSON.parse(body);
                const result = datasetIds.map(id => {
                    const dataset = datasets.get(id);
                    if (!dataset) return null;
                    const sum = dataset.rows.reduce((acc, row) => acc + (Number(row[valueColumn]) || 0), 0);
                    return { datasetId: id, fileName: dataset.fileName, total: sum, rowCount: dataset.rows.length };
                }).filter(Boolean);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, result }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '对比计算失败' }));
            }
        });
        return;
    }
    
    // 静态文件服务
    let filePath = pathname === '/' ? 'index.html' : pathname.slice(1);
    
    if (STATIC_FILES[filePath]) {
        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        return res.end(Buffer.from(STATIC_FILES[filePath], 'base64'));
    }
    
    // SPA 回退
    if (STATIC_FILES['index.html']) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(Buffer.from(STATIC_FILES['index.html'], 'base64'));
    }
    
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
});

// 端口占用错误处理
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log('');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║                                                            ║');
        console.log('║   ⚠️  端口 ' + PORT + ' 已被占用                               ║');
        console.log('║                                                            ║');
        console.log('║   可能原因:                                                ║');
        console.log('║   - 应用已在运行中，请检查浏览器                           ║');
        console.log('║   - 其他程序占用了该端口                                   ║');
        console.log('║                                                            ║');
        console.log('║   解决方法:                                                ║');
        console.log('║   Mac/Linux: lsof -ti:' + PORT + ' | xargs kill -9            ║');
        console.log('║   Windows: netstat -ano | findstr :' + PORT + '               ║');
        console.log('║            然后 taskkill /PID <PID> /F                     ║');
        console.log('║                                                            ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('按任意键退出...');
        
        // 等待用户输入后退出
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.once('data', () => process.exit(1));
        } else {
            setTimeout(() => process.exit(1), 5000);
        }
    } else {
        console.error('服务器错误:', err);
        process.exit(1);
    }
});

server.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                                                            ║');
    console.log('║   🚀 数据可视化分析服务已启动                              ║');
    console.log('║                                                            ║');
    console.log('║   本地访问: http://localhost:' + PORT + '                        ║');
    console.log('║                                                            ║');
    console.log('║   注意: SEA 模式仅支持 CSV 文件上传                        ║');
    console.log('║                                                            ║');
    console.log('║   关闭方式: 按 Ctrl+C 或关闭此窗口                         ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    
    // 自动打开浏览器
    const { exec } = require('child_process');
    const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(openCmd + ' http://localhost:' + PORT);
});
ENTRY_EOF

echo "3. 创建 SEA 配置..."
cat > sea-config.json << 'EOF'
{
  "main": "sea-entry.js",
  "output": "sea-prep.blob",
  "disableExperimentalSEAWarning": true,
  "useCodeCache": true
}
EOF

echo "4. 生成 SEA blob..."
node --experimental-sea-config sea-config.json

if [ ! -f "sea-prep.blob" ]; then
    echo "错误: sea-prep.blob 未生成"
    exit 1
fi

echo "5. 创建可执行文件..."

OS=$(uname -s)
ARCH=$(uname -m)

case "$OS" in
    Darwin)
        OUTPUT_NAME="data-vision-app-mac"
        [ "$ARCH" = "arm64" ] && OUTPUT_NAME="data-vision-app-mac-arm64"
        ;;
    Linux)
        OUTPUT_NAME="data-vision-app-linux"
        ;;
    *)
        OUTPUT_NAME="data-vision-app"
        ;;
esac

cp "$(which node)" "$OUTPUT_NAME"

echo "6. 注入 SEA blob..."

if [ "$OS" = "Darwin" ]; then
    echo "   移除代码签名..."
    codesign --remove-signature "$OUTPUT_NAME" 2>/dev/null || true
    
    echo "   注入 blob..."
    npx postject "$OUTPUT_NAME" NODE_SEA_BLOB sea-prep.blob \
        --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
        --macho-segment-name NODE_SEA
    
    echo "   重新签名..."
    codesign --sign - "$OUTPUT_NAME"
else
    npx postject "$OUTPUT_NAME" NODE_SEA_BLOB sea-prep.blob \
        --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
fi

# 清理
rm -f sea-entry.js sea-config.json sea-prep.blob static-files.json

chmod +x "$OUTPUT_NAME"

SIZE=$(ls -lh "$OUTPUT_NAME" | awk '{print $5}')

echo ""
echo "=========================================="
echo "  构建完成!"
echo "=========================================="
echo "  输出文件: $SEA_DIR/$OUTPUT_NAME"
echo "  文件大小: $SIZE"
echo ""
echo "  使用方式: ./$OUTPUT_NAME"
echo "  然后访问: http://localhost:3456"
echo ""
echo "  注意: SEA 模式仅支持 CSV 文件上传"
echo "=========================================="
