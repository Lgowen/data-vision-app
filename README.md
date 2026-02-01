# 数据可视化分析应用

一个基于 pnpm monorepo 的数据可视化分析工具，支持 CSV/Excel 数据上传、图表分析和数据对比。

提供两种打包方案：**Go 版本**（推荐，体积小）和 **Node.js pkg 版本**。

## 项目结构

```
data-vision-app/
├── packages/
│   ├── web/              # 前端 (React + Vite + Ant Design + AntV Charts)
│   ├── server/           # Node.js 后端 (Express + multer + xlsx)
│   ├── go-server/        # Go 后端 (Gin + excelize)
│   └── shared/           # 共享类型定义
├── scripts/
│   ├── build-go.sh       # Go 版本打包脚本
│   ├── build-pkg.sh      # pkg 版本打包脚本
│   ├── build-sea.sh      # Node.js SEA 打包脚本
│   └── create-portable.sh # 便携包创建脚本
├── go-dist/              # Go 打包产物 (gitignore)
├── pkg-dist/             # pkg 打包产物 (gitignore)
└── sea-dist/             # SEA 打包产物 (gitignore)
```

## 技术栈

### 前端
- React 18 + TypeScript
- Vite 构建工具
- Ant Design 5 UI 组件库
- @ant-design/charts 图表库

### 后端 (两种实现)

| 特性 | Node.js 版本 | Go 版本 |
|------|-------------|---------|
| 框架 | Express | Gin |
| 文件解析 | xlsx + papaparse | excelize |
| 打包大小 | 63-76MB | 12-13MB |
| 启动速度 | 较快 | 极快 |
| 依赖 | 无 | 无 |

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8
- Go >= 1.22 (仅 Go 版本打包需要)

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
# 同时启动前端和后端
pnpm dev

# 或分别启动
pnpm dev:web     # 前端 http://localhost:5173
pnpm dev:server  # 后端 http://localhost:3456
```

### 构建

```bash
# 构建所有包
pnpm build
```

## 打包成可执行文件

### 方案一：Go 版本（推荐）

体积小（12-13MB），启动快，完整支持 CSV 和 Excel。

```bash
# 打包所有平台
./scripts/build-go.sh
```

产物位于 `go-dist/` 目录：
- `data-vision-mac-arm64` - Mac Apple Silicon (M1/M2/M3)
- `data-vision-mac-amd64` - Mac Intel
- `data-vision-windows-amd64.exe` - Windows 64位
- `data-vision-linux-amd64` - Linux 64位
- `data-vision-linux-arm64` - Linux ARM64

### 方案二：pkg 版本

基于 Node.js，体积较大（63-76MB）。

```bash
# 打包所有平台
./scripts/build-pkg.sh
```

产物位于 `pkg-dist/` 目录。

### 方案三：便携包

需要用户安装 Node.js 运行时。

```bash
./scripts/create-portable.sh
```

产物位于 `portable-dist/` 目录。

## 功能特性

### 数据上传
- 支持 CSV、XLSX、XLS 格式
- 文件大小限制 50MB
- 自动解析表头和数据类型

### 图表分析
- 柱状图 (Bar Chart)
- 折线图 (Line Chart)
- 饼图 (Pie Chart)
- 面积图 (Area Chart)

### 计算公式
- `sum` - 求和
- `average` - 平均值
- `max` - 最大值
- `min` - 最小值
- `groupSum` - 分组求和
- `groupAvg` - 分组平均
- `trend` - 趋势分析
- `compare` - 对比分析
- `distribution` - 分布统计
- `statistics` - 综合统计

### 时间聚合
- 按日聚合
- 按周聚合
- 按月聚合
- 按年聚合

### 数据对比
- 多数据集对比分析
- 自动计算汇总值

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/upload` | 上传文件 |
| GET | `/api/datasets` | 获取数据集列表 |
| GET | `/api/datasets/:id` | 获取单个数据集 |
| DELETE | `/api/datasets/:id` | 删除数据集 |
| POST | `/api/calculate` | 计算公式 |
| POST | `/api/aggregate` | 时间聚合 |
| POST | `/api/compare-datasets` | 多数据集对比 |

## 使用说明

### 用户使用（无需开发环境）

1. 下载对应平台的可执行文件
2. 双击运行（或在终端执行）
3. 程序会自动打开浏览器访问 http://localhost:3456
4. 上传 CSV 或 Excel 数据文件
5. 选择图表类型和计算公式
6. 生成可视化图表

### Mac 用户注意

首次运行可能提示"无法验证开发者"，解决方法：
- 右键点击应用 → 打开
- 或在"系统偏好设置 → 安全性与隐私"中允许

## 开发说明

### 目录说明

```
packages/
├── web/                  # 前端代码
│   ├── src/
│   │   ├── App.tsx       # 主应用组件
│   │   ├── pages/        # 页面组件
│   │   │   ├── DataUpload.tsx      # 数据上传
│   │   │   ├── ChartAnalysis.tsx   # 图表分析
│   │   │   ├── DataCompare.tsx     # 数据对比
│   │   │   └── DatasetList.tsx     # 数据集列表
│   │   └── utils/
│   │       └── api.ts    # API 请求封装
│   └── vite.config.ts    # Vite 配置
│
├── server/               # Node.js 后端
│   └── src/
│       ├── index.ts      # 入口文件
│       └── routes/
│           └── api.ts    # API 路由
│
├── go-server/            # Go 后端
│   ├── main.go           # 入口文件
│   ├── handlers.go       # API 处理函数
│   └── go.mod            # Go 模块配置
│
└── shared/               # 共享类型
    └── src/
        └── index.ts      # 类型定义
```

### 添加新功能

1. 在 `packages/shared/src/index.ts` 添加类型定义
2. 在后端（server 或 go-server）实现 API
3. 在前端 `packages/web/src/utils/api.ts` 添加请求方法
4. 在页面组件中使用

## 常见问题

### Q: 端口 3456 被占用怎么办？

```bash
# Mac/Linux
lsof -ti:3456 | xargs kill -9

# Windows
netstat -ano | findstr :3456
taskkill /PID <PID> /F
```

### Q: Go 版本如何重新编译？

```bash
# 确保安装了 Go 1.22+
go version

# 运行打包脚本
./scripts/build-go.sh
```

### Q: pkg 版本打包慢怎么办？

pkg 首次打包需要下载 Node.js 二进制文件，可以手动下载放到缓存目录：
```
~/.pkg-cache/v3.5/
```

## 许可证

MIT
