import React, { useState } from 'react'
import {
  Upload,
  Button,
  Card,
  Table,
  message,
  Space,
  Typography,
  Alert,
  Spin,
  Tag,
  Statistic,
  Row,
  Col
} from 'antd'
import {
  InboxOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  TableOutlined
} from '@ant-design/icons'
import type { UploadProps } from 'antd'
import { uploadFile } from '../utils/api'

const { Dragger } = Upload
const { Title, Text } = Typography

interface DataUploadProps {
  onUploadSuccess?: () => void
}

interface UploadedData {
  datasetId: string
  headers: string[]
  rows: Record<string, unknown>[]
  fileName: string
}

const DataUpload: React.FC<DataUploadProps> = ({ onUploadSuccess }) => {
  const [loading, setLoading] = useState(false)
  const [uploadedData, setUploadedData] = useState<UploadedData | null>(null)

  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options

    setLoading(true)
    try {
      const response = await uploadFile(file as File)

      if (response.success) {
        setUploadedData({
          datasetId: response.datasetId,
          headers: response.data.headers,
          rows: response.data.rows,
          fileName: response.data.fileName
        })
        message.success(`文件 "${response.data.fileName}" 上传成功！`)
        onSuccess?.(response)
      }
    } catch (error) {
      message.error((error as Error).message || '上传失败')
      onError?.(error as Error)
    } finally {
      setLoading(false)
    }
  }

  const columns = uploadedData?.headers.map((header) => ({
    title: header,
    dataIndex: header,
    key: header,
    ellipsis: true,
    width: 150,
    render: (value: unknown) => {
      if (value === null || value === undefined) return '-'
      if (typeof value === 'number') return value.toLocaleString()
      return String(value)
    }
  })) || []

  const tableData = uploadedData?.rows.map((row, index) => ({
    key: index,
    ...row
  })) || []

  return (
    <div>
      <Card bordered={false}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={4} style={{ marginBottom: 8 }}>
              <FileExcelOutlined style={{ marginRight: 8 }} />
              上传数据文件
            </Title>
            <Text type="secondary">
              支持 CSV、XLSX、XLS 格式，文件大小不超过 50MB
            </Text>
          </div>

          <Dragger
            name="file"
            multiple={false}
            accept=".csv,.xlsx,.xls"
            customRequest={handleUpload}
            showUploadList={false}
            disabled={loading}
          >
            <p className="ant-upload-drag-icon">
              {loading ? <Spin size="large" /> : <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />}
            </p>
            <p className="ant-upload-text">
              {loading ? '正在解析文件...' : '点击或拖拽文件到此区域上传'}
            </p>
            <p className="ant-upload-hint">
              支持 Excel (.xlsx, .xls) 和 CSV 格式的数据文件
            </p>
          </Dragger>

          {uploadedData && (
            <>
              <Alert
                message={
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <span>文件上传成功</span>
                    <Tag color="blue">{uploadedData.fileName}</Tag>
                  </Space>
                }
                type="success"
                showIcon={false}
              />

              <Row gutter={16}>
                <Col span={6}>
                  <Card bordered={false} style={{ background: '#f6ffed' }}>
                    <Statistic
                      title="数据行数"
                      value={uploadedData.rows.length}
                      prefix={<TableOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card bordered={false} style={{ background: '#e6f7ff' }}>
                    <Statistic
                      title="数据列数"
                      value={uploadedData.headers.length}
                      prefix={<TableOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card bordered={false} style={{ background: '#fff7e6' }}>
                    <div>
                      <Text type="secondary">数据集 ID</Text>
                      <div>
                        <Text strong copyable>
                          {uploadedData.datasetId}
                        </Text>
                      </div>
                    </div>
                  </Card>
                </Col>
              </Row>

              <Card
                title={
                  <Space>
                    <TableOutlined />
                    <span>数据预览（前 100 行）</span>
                  </Space>
                }
                extra={
                  <Button type="primary" onClick={onUploadSuccess}>
                    开始分析
                  </Button>
                }
                bordered={false}
                style={{ background: '#fafafa' }}
              >
                <Table
                  columns={columns}
                  dataSource={tableData.slice(0, 100)}
                  scroll={{ x: 'max-content', y: 400 }}
                  size="small"
                  pagination={{
                    pageSize: 20,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条数据`
                  }}
                />
              </Card>
            </>
          )}
        </Space>
      </Card>
    </div>
  )
}

export default DataUpload
