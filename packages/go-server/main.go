package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

//go:embed public/*
var staticFiles embed.FS

const PORT = "3456"

func main() {
	gin.SetMode(gin.ReleaseMode)

	r := gin.New()
	r.Use(gin.Recovery())

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		AllowCredentials: true,
	}))

	api := r.Group("/api")
	{
		api.GET("/health", healthHandler)
		api.POST("/upload", uploadHandler)
		api.GET("/datasets", getDatasetsHandler)
		api.GET("/datasets/:id", getDatasetHandler)
		api.DELETE("/datasets/:id", deleteDatasetHandler)
		api.POST("/calculate", calculateHandler)
		api.POST("/aggregate", aggregateHandler)
		api.POST("/compare-datasets", compareDatasetsHandler)
	}

	staticFS, err := fs.Sub(staticFiles, "public")
	if err != nil {
		log.Printf("Warning: No embedded static files: %v", err)
	}

	r.Use(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api") {
			c.Next()
			return
		}

		if staticFS == nil {
			c.JSON(http.StatusOK, gin.H{"message": "Data Vision API Server", "version": "1.0.0"})
			c.Abort()
			return
		}

		reqPath := c.Request.URL.Path
		if reqPath == "/" {
			reqPath = "/index.html"
		}

		filePath := strings.TrimPrefix(reqPath, "/")

		data, err := fs.ReadFile(staticFS, filePath)
		if err != nil {
			data, err = fs.ReadFile(staticFS, "index.html")
			if err != nil {
				c.JSON(http.StatusOK, gin.H{"message": "Data Vision API Server"})
				c.Abort()
				return
			}
			c.Data(http.StatusOK, "text/html; charset=utf-8", data)
			c.Abort()
			return
		}

		ext := path.Ext(filePath)
		contentType := mime.TypeByExtension(ext)
		if contentType == "" {
			contentType = "application/octet-stream"
		}

		c.Data(http.StatusOK, contentType, data)
		c.Abort()
	})

	printBanner()
	go openBrowser(fmt.Sprintf("http://localhost:%s", PORT))

	if err := r.Run(":" + PORT); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func printBanner() {
	fmt.Println(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 数据可视化分析服务已启动                              ║
║                                                            ║
║   本地访问: http://localhost:3456                          ║
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
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Start(); err != nil {
		fmt.Printf("请在浏览器中打开: %s\n", url)
	}
}

func isProduction() bool {
	executable, err := os.Executable()
	if err != nil {
		return false
	}
	return executable != ""
}

func getExecutableDir() string {
	executable, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(executable)
}
