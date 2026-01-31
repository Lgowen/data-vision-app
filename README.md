# 数据可视化分析应用

一个基于 pnpm monorepo 的数据可视化分析工具，支持 CSV/Excel 数据上传、图表分析和数据对比。

## 项目结构

```
data-vision-app/
├── packages/
│   ├── web/          # 前端 (React + Vite + Ant Design + AntV Charts)
│   ├── server/       # 后端 (Express + multer + xlsx)
│   └── shared/       # 共享类型定义
├── package.json      # 根配置
└── pnpm-workspace.yaml
```

## 技术栈

- **前端**: React 18 + TypeScript + Vite + Ant Design 5 + @ant-design/charts
- **后端**: Express + multer + xlsx + papaparse
- **构建**: pnpm monorepo + pkg (打包成 exe)

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8

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

### 打包成可执行文件

```bash
# 打包 Windows 和 Mac (Intel) 版本
pnpm package

# 只打包 Windows 版本
pnpm package:win

# 只打包 Mac Intel 版本
pnpm package:mac

# 只打包 Mac Apple Silicon (M1/M2) 版本
pnpm package:mac-arm

# 打包所有平台版本
pnpm package:all
```

打包后的文件位于 `packages/server/dist/` 目录：
- `data-vision-app-win.exe` - Windows 版本
- `data-vision-app-mac` - Mac Intel 版本
- `data-vision-app-mac-arm` - Mac Apple Silicon 版本

## 功能特性

1. **数据上传**: 支持 CSV、XLSX、XLS 格式
2. **图表分析**: 柱状图、折线图、饼图、面积图
3. **计算公式**: 求和、平均、最大、最小、分组统计
4. **时间聚合**: 按日/周/月/年聚合数据
5. **数据对比**: 多数据集对比分析

## 使用说明

1. 双击运行 `data-vision-app.exe`
2. 程序会自动打开浏览器访问 http://localhost:3456
3. 上传 CSV 或 Excel 数据文件
4. 选择图表类型和计算公式
5. 生成可视化图表

## 许可证

MIT
