package main

import (
	"encoding/csv"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

type ParsedData struct {
	Headers    []string                 `json:"headers"`
	Rows       []map[string]interface{} `json:"rows"`
	FileName   string                   `json:"fileName"`
	UploadTime string                   `json:"uploadTime"`
}

type DatasetInfo struct {
	ID         string   `json:"id"`
	FileName   string   `json:"fileName"`
	UploadTime string   `json:"uploadTime"`
	RowCount   int      `json:"rowCount"`
	Headers    []string `json:"headers"`
}

type CalculationResult struct {
	Type    string      `json:"type"`
	Data    interface{} `json:"data"`
	Summary *Summary    `json:"summary,omitempty"`
}

type Summary struct {
	Sum     float64 `json:"sum"`
	Average float64 `json:"average"`
	Max     float64 `json:"max"`
	Min     float64 `json:"min"`
	Median  float64 `json:"median"`
	Count   int     `json:"count"`
}

type GroupedData struct {
	Name  string  `json:"name"`
	Value float64 `json:"value"`
}

type TrendData struct {
	X interface{} `json:"x"`
	Y float64     `json:"y"`
}

type CompareData struct {
	Category interface{} `json:"category"`
	Value    float64     `json:"value"`
}

type DistributionData struct {
	Type    string  `json:"type"`
	Value   float64 `json:"value"`
	Percent float64 `json:"percent"`
}

type AggregatedData struct {
	Period string  `json:"period"`
	Value  float64 `json:"value"`
}

type CompareResult struct {
	DatasetID string                   `json:"datasetId"`
	FileName  string                   `json:"fileName"`
	Total     float64                  `json:"total"`
	RowCount  int                      `json:"rowCount"`
	Data      []map[string]interface{} `json:"data"`
}

var (
	datasets     = make(map[string]*ParsedData)
	datasetsLock sync.RWMutex
)

func healthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "timestamp": time.Now().Format(time.RFC3339)})
}

func uploadHandler(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请选择要上传的文件"})
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext != ".csv" && ext != ".xlsx" && ext != ".xls" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "只支持 CSV、XLSX、XLS 格式的文件"})
		return
	}

	tempFile, err := os.CreateTemp("", "upload-*"+ext)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "文件保存失败"})
		return
	}
	defer os.Remove(tempFile.Name())
	defer tempFile.Close()

	if _, err := io.Copy(tempFile, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "文件保存失败"})
		return
	}

	parsedData, err := parseFile(tempFile.Name(), header.Filename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("文件解析失败: %v", err)})
		return
	}

	datasetID := strconv.FormatInt(time.Now().UnixMilli(), 10)

	datasetsLock.Lock()
	datasets[datasetID] = parsedData
	datasetsLock.Unlock()

	c.JSON(http.StatusOK, gin.H{"success": true, "datasetId": datasetID, "data": parsedData})
}

func parseFile(filePath, originalName string) (*ParsedData, error) {
	ext := strings.ToLower(filepath.Ext(originalName))
	var headers []string
	var rows []map[string]interface{}

	if ext == ".csv" {
		file, err := os.Open(filePath)
		if err != nil {
			return nil, err
		}
		defer file.Close()

		reader := csv.NewReader(file)
		reader.LazyQuotes = true

		headerRow, err := reader.Read()
		if err != nil {
			return nil, err
		}
		headers = headerRow

		for {
			record, err := reader.Read()
			if err == io.EOF {
				break
			}
			if err != nil {
				continue
			}

			row := make(map[string]interface{})
			for i, value := range record {
				if i < len(headers) {
					if num, err := strconv.ParseFloat(value, 64); err == nil {
						row[headers[i]] = num
					} else {
						row[headers[i]] = value
					}
				}
			}
			rows = append(rows, row)
		}
	} else {
		f, err := excelize.OpenFile(filePath)
		if err != nil {
			return nil, err
		}
		defer f.Close()

		sheetName := f.GetSheetName(0)
		rowsData, err := f.GetRows(sheetName)
		if err != nil {
			return nil, err
		}

		if len(rowsData) > 0 {
			headers = rowsData[0]
			for i := 1; i < len(rowsData); i++ {
				row := make(map[string]interface{})
				for j, value := range rowsData[i] {
					if j < len(headers) {
						if num, err := strconv.ParseFloat(value, 64); err == nil {
							row[headers[j]] = num
						} else {
							row[headers[j]] = value
						}
					}
				}
				rows = append(rows, row)
			}
		}
	}

	return &ParsedData{Headers: headers, Rows: rows, FileName: originalName, UploadTime: time.Now().Format(time.RFC3339)}, nil
}

func getDatasetsHandler(c *gin.Context) {
	datasetsLock.RLock()
	defer datasetsLock.RUnlock()

	list := make([]DatasetInfo, 0, len(datasets))
	for id, data := range datasets {
		list = append(list, DatasetInfo{ID: id, FileName: data.FileName, UploadTime: data.UploadTime, RowCount: len(data.Rows), Headers: data.Headers})
	}
	c.JSON(http.StatusOK, list)
}

func getDatasetHandler(c *gin.Context) {
	id := c.Param("id")
	datasetsLock.RLock()
	dataset, exists := datasets[id]
	datasetsLock.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "数据集不存在"})
		return
	}
	c.JSON(http.StatusOK, dataset)
}

func deleteDatasetHandler(c *gin.Context) {
	id := c.Param("id")
	datasetsLock.Lock()
	_, exists := datasets[id]
	if exists {
		delete(datasets, id)
	}
	datasetsLock.Unlock()
	c.JSON(http.StatusOK, gin.H{"success": exists})
}

type CalculateRequest struct {
	DatasetID string `json:"datasetId"`
	Formula   string `json:"formula"`
	ColumnX   string `json:"columnX"`
	ColumnY   string `json:"columnY"`
}

func calculateHandler(c *gin.Context) {
	var req CalculateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	datasetsLock.RLock()
	dataset, exists := datasets[req.DatasetID]
	datasetsLock.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "数据集不存在"})
		return
	}

	result := calculateFormula(dataset.Rows, req.Formula, req.ColumnX, req.ColumnY)
	c.JSON(http.StatusOK, gin.H{"success": true, "result": result})
}

func calculateFormula(rows []map[string]interface{}, formula, columnX, columnY string) *CalculationResult {
	yValues := make([]float64, 0, len(rows))
	for _, row := range rows {
		if val, ok := row[columnY]; ok {
			yValues = append(yValues, toFloat64(val))
		}
	}

	switch formula {
	case "sum":
		sum := 0.0
		for _, v := range yValues {
			sum += v
		}
		return &CalculationResult{Type: "single", Data: sum}
	case "average":
		if len(yValues) == 0 {
			return &CalculationResult{Type: "single", Data: 0}
		}
		sum := 0.0
		for _, v := range yValues {
			sum += v
		}
		return &CalculationResult{Type: "single", Data: sum / float64(len(yValues))}
	case "max":
		if len(yValues) == 0 {
			return &CalculationResult{Type: "single", Data: 0}
		}
		maxVal := yValues[0]
		for _, v := range yValues[1:] {
			if v > maxVal {
				maxVal = v
			}
		}
		return &CalculationResult{Type: "single", Data: maxVal}
	case "min":
		if len(yValues) == 0 {
			return &CalculationResult{Type: "single", Data: 0}
		}
		minVal := yValues[0]
		for _, v := range yValues[1:] {
			if v < minVal {
				minVal = v
			}
		}
		return &CalculationResult{Type: "single", Data: minVal}
	case "groupSum":
		grouped := make(map[string]float64)
		for _, row := range rows {
			key := toString(row[columnX])
			grouped[key] += toFloat64(row[columnY])
		}
		data := make([]GroupedData, 0, len(grouped))
		for name, value := range grouped {
			data = append(data, GroupedData{Name: name, Value: value})
		}
		return &CalculationResult{Type: "grouped", Data: data}
	case "groupAvg":
		groupedSum := make(map[string]float64)
		groupedCount := make(map[string]int)
		for _, row := range rows {
			key := toString(row[columnX])
			groupedSum[key] += toFloat64(row[columnY])
			groupedCount[key]++
		}
		data := make([]GroupedData, 0, len(groupedSum))
		for name, sum := range groupedSum {
			data = append(data, GroupedData{Name: name, Value: sum / float64(groupedCount[name])})
		}
		return &CalculationResult{Type: "grouped", Data: data}
	case "trend":
		data := make([]TrendData, 0, len(rows))
		for _, row := range rows {
			data = append(data, TrendData{X: row[columnX], Y: toFloat64(row[columnY])})
		}
		return &CalculationResult{Type: "trend", Data: data}
	case "compare":
		data := make([]CompareData, 0, len(rows))
		for _, row := range rows {
			data = append(data, CompareData{Category: row[columnX], Value: toFloat64(row[columnY])})
		}
		return &CalculationResult{Type: "compare", Data: data}
	case "distribution":
		total := 0.0
		for _, v := range yValues {
			total += v
		}
		data := make([]DistributionData, 0, len(rows))
		for _, row := range rows {
			value := toFloat64(row[columnY])
			percent := 0.0
			if total > 0 {
				percent = (value / total) * 100
			}
			data = append(data, DistributionData{Type: toString(row[columnX]), Value: value, Percent: percent})
		}
		return &CalculationResult{Type: "distribution", Data: data}
	case "statistics":
		if len(yValues) == 0 {
			return &CalculationResult{Type: "statistics", Data: []TrendData{}}
		}
		sum := 0.0
		for _, v := range yValues {
			sum += v
		}
		avg := sum / float64(len(yValues))
		sorted := make([]float64, len(yValues))
		copy(sorted, yValues)
		sort.Float64s(sorted)
		var median float64
		n := len(sorted)
		if n%2 == 0 {
			median = (sorted[n/2-1] + sorted[n/2]) / 2
		} else {
			median = sorted[n/2]
		}
		maxVal := sorted[n-1]
		minVal := sorted[0]
		data := make([]TrendData, 0, len(rows))
		for _, row := range rows {
			data = append(data, TrendData{X: row[columnX], Y: toFloat64(row[columnY])})
		}
		return &CalculationResult{Type: "statistics", Data: data, Summary: &Summary{Sum: sum, Average: avg, Max: maxVal, Min: minVal, Median: median, Count: len(yValues)}}
	default:
		return &CalculationResult{Type: "raw", Data: rows}
	}
}

type AggregateRequest struct {
	DatasetID   string `json:"datasetId"`
	DateColumn  string `json:"dateColumn"`
	ValueColumn string `json:"valueColumn"`
	Period      string `json:"period"`
}

func aggregateHandler(c *gin.Context) {
	var req AggregateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	datasetsLock.RLock()
	dataset, exists := datasets[req.DatasetID]
	datasetsLock.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "数据集不存在"})
		return
	}

	result := aggregateByPeriod(dataset.Rows, req.DateColumn, req.ValueColumn, req.Period)
	c.JSON(http.StatusOK, gin.H{"success": true, "result": result})
}

func aggregateByPeriod(rows []map[string]interface{}, dateColumn, valueColumn, period string) map[string]interface{} {
	grouped := make(map[string][]float64)

	for _, row := range rows {
		dateValue := row[dateColumn]
		if dateValue == nil {
			continue
		}
		dateStr := toString(dateValue)
		t, err := parseDate(dateStr)
		if err != nil {
			continue
		}

		var key string
		switch period {
		case "day":
			key = t.Format("2006-01-02")
		case "week":
			weekStart := t.AddDate(0, 0, -int(t.Weekday()))
			key = weekStart.Format("2006-01-02") + " 周"
		case "month":
			key = t.Format("2006-01")
		case "year":
			key = t.Format("2006")
		}
		grouped[key] = append(grouped[key], toFloat64(row[valueColumn]))
	}

	data := make([]AggregatedData, 0, len(grouped))
	for period, values := range grouped {
		sum := 0.0
		for _, v := range values {
			sum += v
		}
		data = append(data, AggregatedData{Period: period, Value: sum})
	}
	sort.Slice(data, func(i, j int) bool { return data[i].Period < data[j].Period })

	return map[string]interface{}{"data": data}
}

type CompareDatasetsRequest struct {
	DatasetIDs  []string `json:"datasetIds"`
	ValueColumn string   `json:"valueColumn"`
	LabelColumn string   `json:"labelColumn"`
}

func compareDatasetsHandler(c *gin.Context) {
	var req CompareDatasetsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	datasetsLock.RLock()
	defer datasetsLock.RUnlock()

	results := make([]CompareResult, 0)
	for _, id := range req.DatasetIDs {
		dataset, exists := datasets[id]
		if !exists {
			continue
		}
		sum := 0.0
		data := make([]map[string]interface{}, 0, len(dataset.Rows))
		for _, row := range dataset.Rows {
			value := toFloat64(row[req.ValueColumn])
			sum += value
			data = append(data, map[string]interface{}{"label": row[req.LabelColumn], "value": value})
		}
		results = append(results, CompareResult{DatasetID: id, FileName: dataset.FileName, Total: sum, RowCount: len(dataset.Rows), Data: data})
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "result": results})
}

func toFloat64(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case string:
		if f, err := strconv.ParseFloat(val, 64); err == nil {
			return f
		}
	}
	return 0
}

func toString(v interface{}) string {
	if v == nil {
		return ""
	}
	switch val := v.(type) {
	case string:
		return val
	case float64:
		if val == math.Trunc(val) {
			return strconv.FormatInt(int64(val), 10)
		}
		return strconv.FormatFloat(val, 'f', -1, 64)
	case int:
		return strconv.Itoa(val)
	case int64:
		return strconv.FormatInt(val, 10)
	default:
		return fmt.Sprintf("%v", v)
	}
}

func parseDate(s string) (time.Time, error) {
	formats := []string{"2006-01-02", "2006/01/02", "2006-01-02 15:04:05", "2006/01/02 15:04:05", "01/02/2006", "02-01-2006", time.RFC3339}
	for _, format := range formats {
		if t, err := time.Parse(format, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("cannot parse date: %s", s)
}
