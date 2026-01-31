import React, { useState, useEffect } from 'react'
import {
  Card,
  Select,
  Button,
  Space,
  Row,
  Col,
  Empty,
  Spin,
  message,
  Table,
  Statistic,
  Typography,
  Tag
} from 'antd'
import {
  SwapOutlined,
  BarChartOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined
} from '@ant-design/icons'
import { Column } from '@ant-design/charts'
import { getDatasets, compareDatasets } from '../utils/api'

const { Text } = Typography

interface DatasetOption {
  id: string
  fileName: string
  headers: string[]
  rowCount: number
}

interface CompareResult {
  datasetId: string
  fileName: string
  total: number
  rowCount: number
  data: Array<{ label: unknown; value: number }>
}

const DataCompare: React.FC = () => {
  const [datasets, setDatasets] = useState<DatasetOption[]>([])
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([])
  const [commonHeaders, setCommonHeaders] = useState<string[]>([])
  const [valueColumn, setValueColumn] = useState<string>('')
  const [labelColumn, setLabelColumn] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [compareResult, setCompareResult] = useState<CompareResult[]>([])

  useEffect(() => {
    loadDatasets()
  }, [])

  const loadDatasets = async () => {
    try {
      const list = await getDatasets()
      setDatasets(list)
    } catch {
      message.error('加载数据集失败')
    }
  }

  // 当选择的数据集变化时，计算公共列
  const handleDatasetsChange = (ids: string[]) => {
    setSelectedDatasets(ids)

    if (ids.length === 0) {
      setCommonHeaders([])
      return
    }

    // 找出所有选中数据集的公共列
    const selectedData = ids.map((id) => datasets.find((d) => d.id === id))
    const allHeaders = selectedData.map((d) => d?.headers || [])

    const common = allHeaders.reduce((acc, headers) => {
      if (acc.length === 0) return headers
      return acc.filter((h) => headers.includes(h))
    }, [] as string[])

    setCommonHeaders(common)

    if (common.length >= 2) {
      setLabelColumn(common[0])
      setValueColumn(common[1])
    }
  }

  // 执行对比
  const handleCompare = async () => {
    if (selectedDatasets.length < 2) {
      message.warning('请至少选择两个数据集进行对比')
      return
    }

    if (!valueColumn || !labelColumn) {
      message.warning('请选择对比的数据列')
      return
    }

    setLoading(true)
    try {
      const response = await compareDatasets({
        datasetIds: selectedDatasets,
        valueColumn,
        labelColumn
      })

      setCompareResult(response.result)
      message.success('对比完成')
    } catch {
      message.error('对比失败')
    } finally {
      setLoading(false)
    }
  }

  // 渲染对比图表
  const renderCompareChart = () => {
    if (compareResult.length === 0) {
      return <Empty description="请选择数据集并执行对比" />
    }

    // 构建对比数据
    const chartData = compareResult.map((result) => ({
      dataset: result.fileName,
      total: result.total
    }))

    return (
      <Column
        data={chartData}
        xField="dataset"
        yField="total"
        height={300}
        label={{
          position: 'top'
        }}
        columnStyle={{
          radius: [4, 4, 0, 0]
        }}
        color={['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1']}
        seriesField="dataset"
      />
    )
  }

  // 计算变化率
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return 0
    return ((current - previous) / previous) * 100
  }

  // 对比结果表格
  const compareColumns = [
    {
      title: '数据集',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '数据行数',
      dataIndex: 'rowCount',
      key: 'rowCount',
      render: (value: number) => value.toLocaleString()
    },
    {
      title: `${valueColumn} 总计`,
      dataIndex: 'total',
      key: 'total',
      render: (value: number) => (
        <Text strong style={{ color: '#1890ff' }}>
          {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </Text>
      )
    },
    {
      title: '环比变化',
      key: 'change',
      render: (_: unknown, record: CompareResult, index: number) => {
        if (index === 0) return '-'
        const change = calculateChange(record.total, compareResult[index - 1].total)
        const isUp = change > 0
        return (
          <Space>
            {isUp ? (
              <ArrowUpOutlined style={{ color: '#52c41a' }} />
            ) : (
              <ArrowDownOutlined style={{ color: '#f5222d' }} />
            )}
            <Text style={{ color: isUp ? '#52c41a' : '#f5222d' }}>
              {Math.abs(change).toFixed(2)}%
            </Text>
          </Space>
        )
      }
    }
  ]

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 配置区域 */}
        <Card bordered={false}>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <div>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  选择要对比的数据集（至少2个）
                </Text>
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  value={selectedDatasets}
                  onChange={handleDatasetsChange}
                  placeholder="请选择数据集"
                  maxTagCount={3}
                  options={datasets.map((d) => ({
                    value: d.id,
                    label: `${d.fileName} (${d.rowCount}行)`
                  }))}
                />
              </div>
            </Col>
            <Col span={6}>
              <div>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  标签列（分类）
                </Text>
                <Select
                  style={{ width: '100%' }}
                  value={labelColumn}
                  onChange={setLabelColumn}
                  placeholder="选择列"
                  disabled={commonHeaders.length === 0}
                  options={commonHeaders.map((h) => ({ value: h, label: h }))}
                />
              </div>
            </Col>
            <Col span={6}>
              <div>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  数值列（对比值）
                </Text>
                <Select
                  style={{ width: '100%' }}
                  value={valueColumn}
                  onChange={setValueColumn}
                  placeholder="选择列"
                  disabled={commonHeaders.length === 0}
                  options={commonHeaders.map((h) => ({ value: h, label: h }))}
                />
              </div>
            </Col>
            <Col span={4}>
              <div>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  &nbsp;
                </Text>
                <Button
                  type="primary"
                  icon={<SwapOutlined />}
                  onClick={handleCompare}
                  loading={loading}
                  disabled={selectedDatasets.length < 2}
                  block
                >
                  开始对比
                </Button>
              </div>
            </Col>
          </Row>
        </Card>

        {/* 对比结果 */}
        {compareResult.length > 0 && (
          <>
            {/* 汇总统计 */}
            <Card bordered={false}>
              <Row gutter={16}>
                {compareResult.map((result, index) => (
                  <Col span={24 / compareResult.length} key={result.datasetId}>
                    <Card
                      bordered={false}
                      style={{
                        background: index === 0 ? '#e6f7ff' : index === 1 ? '#f6ffed' : '#fff7e6'
                      }}
                    >
                      <Statistic
                        title={result.fileName}
                        value={result.total}
                        precision={2}
                        prefix={<BarChartOutlined />}
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>

            {/* 对比图表 */}
            <Card
              bordered={false}
              title={
                <Space>
                  <BarChartOutlined />
                  <span>数据集总量对比</span>
                </Space>
              }
            >
              <Spin spinning={loading}>{renderCompareChart()}</Spin>
            </Card>

            {/* 对比表格 */}
            <Card
              bordered={false}
              title={
                <Space>
                  <SwapOutlined />
                  <span>详细对比数据</span>
                </Space>
              }
            >
              <Table
                columns={compareColumns}
                dataSource={compareResult.map((r) => ({ ...r, key: r.datasetId }))}
                pagination={false}
              />
            </Card>
          </>
        )}
      </Space>
    </div>
  )
}

export default DataCompare
