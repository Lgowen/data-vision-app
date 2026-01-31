// 数据集信息
export interface DatasetInfo {
  id: string
  fileName: string
  uploadTime: string
  rowCount: number
  headers: string[]
}

// 解析后的数据
export interface ParsedData {
  headers: string[]
  rows: Record<string, unknown>[]
  fileName: string
  uploadTime: string
}

// 上传响应
export interface UploadResponse {
  success: boolean
  datasetId: string
  data: ParsedData
}

// 计算结果
export interface CalculationResult {
  type: 'single' | 'grouped' | 'trend' | 'compare' | 'distribution' | 'statistics' | 'raw'
  data: unknown
  summary?: {
    sum: number
    average: number
    max: number
    min: number
    median: number
    count: number
  }
}

// 计算请求
export interface CalculateRequest {
  datasetId: string
  formula: FormulaType
  columnX: string
  columnY: string
}

// 聚合请求
export interface AggregateRequest {
  datasetId: string
  dateColumn: string
  valueColumn: string
  period: PeriodType
}

// 公式类型
export type FormulaType =
  | 'sum'
  | 'average'
  | 'max'
  | 'min'
  | 'groupSum'
  | 'groupAvg'
  | 'trend'
  | 'compare'
  | 'distribution'
  | 'statistics'

// 时间周期类型
export type PeriodType = 'day' | 'week' | 'month' | 'year'

// 图表类型
export type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'column'

// 图表配置
export interface ChartConfig {
  type: ChartType
  title: string
  xField: string
  yField: string
  data: unknown[]
}

// API 响应基础类型
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// 数据集对比请求
export interface CompareRequest {
  datasetIds: string[]
  valueColumn: string
  labelColumn: string
}

// 数据集对比结果
export interface CompareResult {
  datasetId: string
  fileName: string
  total: number
  rowCount: number
  data: Array<{ label: unknown; value: number }>
}
