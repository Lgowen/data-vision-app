import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { apiRouter } from './routes/api'

const app = express()
const PORT = process.env.PORT || 3456

// 中间件
app.use(cors())
app.use(express.json())

// API 路由
app.use('/api', apiRouter)

// 静态文件服务（生产环境提供前端文件）
const staticPath = path.join(__dirname, 'public')
app.use(express.static(staticPath))

// SPA 路由回退
app.get('*', (req, res) => {
  const indexPath = path.join(staticPath, 'index.html')
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).json({
        message: 'Data Vision API Server',
        version: '1.0.0',
        endpoints: {
          health: '/api/health',
          upload: '/api/upload',
          datasets: '/api/datasets',
          calculate: '/api/calculate',
          aggregate: '/api/aggregate'
        }
      })
    }
  })
})

// 启动服务器
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 数据可视化分析服务已启动                              ║
║                                                            ║
║   本地访问: http://localhost:${PORT}                        ║
║                                                            ║
║   API 端点:                                                ║
║   - GET  /api/health      健康检查                         ║
║   - POST /api/upload      上传文件                         ║
║   - GET  /api/datasets    获取数据集列表                   ║
║   - POST /api/calculate   计算公式                         ║
║   - POST /api/aggregate   时间聚合                         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `)

  // 生产环境自动打开浏览器
  if (process.env.NODE_ENV === 'production' || (process as NodeJS.Process & { pkg?: unknown }).pkg) {
    import('open').then((open) => {
      open.default(`http://localhost:${PORT}`)
    }).catch(() => {
      console.log(`请在浏览器中打开: http://localhost:${PORT}`)
    })
  }
})

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...')
  server.close(() => {
    console.log('服务器已关闭')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('\n收到 SIGINT 信号，正在关闭服务器...')
  server.close(() => {
    console.log('服务器已关闭')
    process.exit(0)
  })
})

export { app }
