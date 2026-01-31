import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Popconfirm,
  message,
  Typography,
  Empty,
  Modal,
  Descriptions
} from 'antd'
import {
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  FileExcelOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'
import { getDatasets, getDataset, deleteDataset } from '../utils/api'
import dayjs from 'dayjs'

const { Text } = Typography

interface DatasetInfo {
  id: string
  fileName: string
  uploadTime: string
  rowCount: number
  headers: string[]
}

interface DatasetDetail {
  headers: string[]
  rows: Record<string, unknown>[]
  fileName: string
  uploadTime: string
}

const DatasetList: React.FC = () => {
  const [datasets, setDatasets] = useState<DatasetInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedDataset, setSelectedDataset] = useState<DatasetDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    loadDatasets()
  }, [])

  const loadDatasets = async () => {
    setLoading(true)
    try {
      const list = await getDatasets()
      setDatasets(list)
    } catch {
      message.error('加载数据集失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteDataset(id)
      message.success('删除成功')
      loadDatasets()
    } catch {
      message.error('删除失败')
    }
  }

  const handleViewDetail = async (id: string) => {
    setDetailLoading(true)
    setDetailVisible(true)
    try {
      const data = await getDataset(id)
      setSelectedDataset(data)
    } catch {
      message.error('加载详情失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const columns = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (text: string) => (
        <Space>
          <FileExcelOutlined style={{ color: '#52c41a' }} />
          <Text strong>{text}</Text>
        </Space>
      )
    },
    {
      title: '数据行数',
      dataIndex: 'rowCount',
      key: 'rowCount',
      width: 120,
      render: (value: number) => (
        <Tag color="blue">{value.toLocaleString()} 行</Tag>
      )
    },
    {
      title: '数据列',
      dataIndex: 'headers',
      key: 'headers',
      width: 300,
      render: (headers: string[]) => (
        <Space wrap size={[4, 4]}>
          {headers.slice(0, 5).map((h) => (
            <Tag key={h}>{h}</Tag>
          ))}
          {headers.length > 5 && <Tag>+{headers.length - 5}</Tag>}
        </Space>
      )
    },
    {
      title: '上传时间',
      dataIndex: 'uploadTime',
      key: 'uploadTime',
      width: 180,
      render: (time: string) => (
        <Space>
          <ClockCircleOutlined />
          <Text type="secondary">{dayjs(time).format('YYYY-MM-DD HH:mm:ss')}</Text>
        </Space>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: DatasetInfo) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record.id)}
          >
            查看
          </Button>
          <Popconfirm
            title="确定要删除这个数据集吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  // 详情弹窗中的表格列
  const detailColumns = selectedDataset?.headers.map((header) => ({
    title: header,
    dataIndex: header,
    key: header,
    ellipsis: true,
    width: 120,
    render: (value: unknown) => {
      if (value === null || value === undefined) return '-'
      if (typeof value === 'number') return value.toLocaleString()
      return String(value)
    }
  })) || []

  return (
    <div>
      <Card
        bordered={false}
        title={
          <Space>
            <FileExcelOutlined />
            <span>数据集管理</span>
            <Tag color="blue">{datasets.length} 个数据集</Tag>
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadDatasets} loading={loading}>
            刷新
          </Button>
        }
      >
        {datasets.length === 0 ? (
          <Empty description="暂无数据集，请先上传数据" />
        ) : (
          <Table
            columns={columns}
            dataSource={datasets.map((d) => ({ ...d, key: d.id }))}
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个数据集`
            }}
          />
        )}
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title={
          <Space>
            <FileExcelOutlined style={{ color: '#52c41a' }} />
            <span>数据集详情</span>
          </Space>
        }
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={1000}
      >
        {selectedDataset && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="文件名">
                {selectedDataset.fileName}
              </Descriptions.Item>
              <Descriptions.Item label="上传时间">
                {dayjs(selectedDataset.uploadTime).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="数据行数">
                {selectedDataset.rows.length.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="数据列数">
                {selectedDataset.headers.length}
              </Descriptions.Item>
              <Descriptions.Item label="数据列" span={2}>
                <Space wrap>
                  {selectedDataset.headers.map((h) => (
                    <Tag key={h} color="blue">
                      {h}
                    </Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            </Descriptions>

            <Table
              columns={detailColumns}
              dataSource={selectedDataset.rows.slice(0, 100).map((row, index) => ({
                key: index,
                ...row
              }))}
              loading={detailLoading}
              scroll={{ x: 'max-content', y: 400 }}
              size="small"
              pagination={{
                pageSize: 20,
                showTotal: () =>
                  `显示前 100 条，共 ${selectedDataset.rows.length.toLocaleString()} 条`
              }}
            />
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default DatasetList
