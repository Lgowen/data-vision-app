const API_BASE = '/api'

// 通用请求方法
async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }))
    throw new Error(error.error || '请求失败')
  }

  return response.json()
}

// 健康检查
export const checkHealth = () => request<{ status: string; timestamp: string }>('/health')

// 上传文件
export const uploadFile = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '上传失败' }))
    throw new Error(error.error || '上传失败')
  }

  return response.json()
}

// 获取数据集列表
export const getDatasets = () =>
  request<
    Array<{
      id: string
      fileName: string
      uploadTime: string
      rowCount: number
      headers: string[]
    }>
  >('/datasets')

// 获取单个数据集
export const getDataset = (id: string) =>
  request<{
    headers: string[]
    rows: Record<string, unknown>[]
    fileName: string
    uploadTime: string
  }>(`/datasets/${id}`)

// 删除数据集
export const deleteDataset = (id: string) =>
  request<{ success: boolean }>(`/datasets/${id}`, { method: 'DELETE' })

// 计算公式
export const calculate = (params: {
  datasetId: string
  formula: string
  columnX: string
  columnY: string
}) =>
  request<{
    success: boolean
    result: {
      type: string
      data: unknown
      summary?: Record<string, number>
    }
  }>('/calculate', {
    method: 'POST',
    body: JSON.stringify(params)
  })

// 时间维度聚合
export const aggregate = (params: {
  datasetId: string
  dateColumn: string
  valueColumn: string
  period: 'day' | 'week' | 'month' | 'year'
}) =>
  request<{
    success: boolean
    result: {
      data: Array<{ period: string; value: number }>
    }
  }>('/aggregate', {
    method: 'POST',
    body: JSON.stringify(params)
  })

// 多数据集对比
export const compareDatasets = (params: {
  datasetIds: string[]
  valueColumn: string
  labelColumn: string
}) =>
  request<{
    success: boolean
    result: Array<{
      datasetId: string
      fileName: string
      total: number
      rowCount: number
      data: Array<{ label: unknown; value: number }>
    }>
  }>('/compare-datasets', {
    method: 'POST',
    body: JSON.stringify(params)
  })
