import React, { useState } from 'react'
import { Layout, Menu, theme } from 'antd'
import {
  UploadOutlined,
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  TableOutlined,
  SettingOutlined
} from '@ant-design/icons'
import DataUpload from './pages/DataUpload'
import ChartAnalysis from './pages/ChartAnalysis'
import DataCompare from './pages/DataCompare'
import DatasetList from './pages/DatasetList'

const { Header, Sider, Content } = Layout

type PageKey = 'upload' | 'analysis' | 'compare' | 'datasets'

const App: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false)
  const [currentPage, setCurrentPage] = useState<PageKey>('upload')
  const {
    token: { colorBgContainer, borderRadiusLG }
  } = theme.useToken()

  const menuItems = [
    {
      key: 'upload',
      icon: <UploadOutlined />,
      label: '数据上传'
    },
    {
      key: 'analysis',
      icon: <BarChartOutlined />,
      label: '图表分析'
    },
    {
      key: 'compare',
      icon: <LineChartOutlined />,
      label: '数据对比'
    },
    {
      key: 'datasets',
      icon: <TableOutlined />,
      label: '数据管理'
    }
  ]

  const renderPage = () => {
    switch (currentPage) {
      case 'upload':
        return <DataUpload onUploadSuccess={() => setCurrentPage('analysis')} />
      case 'analysis':
        return <ChartAnalysis />
      case 'compare':
        return <DataCompare />
      case 'datasets':
        return <DatasetList />
      default:
        return <DataUpload onUploadSuccess={() => setCurrentPage('analysis')} />
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        theme="light"
        style={{
          boxShadow: '2px 0 8px rgba(0,0,0,0.05)'
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #f0f0f0'
          }}
        >
          <PieChartOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          {!collapsed && (
            <span style={{ marginLeft: 8, fontSize: 16, fontWeight: 600, color: '#1890ff' }}>
              数据可视化
            </span>
          )}
        </div>
        <Menu
          theme="light"
          selectedKeys={[currentPage]}
          mode="inline"
          items={menuItems}
          onClick={({ key }) => setCurrentPage(key as PageKey)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>
            {menuItems.find((item) => item.key === currentPage)?.label}
          </h2>
          <SettingOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
        </Header>
        <Content
          style={{
            margin: 24,
            padding: 24,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            minHeight: 280,
            overflow: 'auto'
          }}
        >
          {renderPage()}
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
