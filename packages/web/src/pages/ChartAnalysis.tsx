import React, { useState, useEffect } from "react";
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
  Statistic,
  Segmented,
  Typography,
  Divider,
} from "antd";
import {
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  AreaChartOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Line, Column, Pie, Area } from "@ant-design/charts";
import { getDatasets, getDataset, calculate, aggregate } from "../utils/api";

const { Text } = Typography;

interface DatasetOption {
  id: string;
  fileName: string;
  headers: string[];
  rowCount: number;
}

type ChartType = "line" | "column" | "pie" | "area";
type FormulaType =
  | "trend"
  | "compare"
  | "distribution"
  | "groupSum"
  | "groupAvg"
  | "statistics";
type PeriodType = "day" | "week" | "month" | "year";

const ChartAnalysis: React.FC = () => {
  const [datasets, setDatasets] = useState<DatasetOption[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [selectedHeaders, setSelectedHeaders] = useState<string[]>([]);
  const [columnX, setColumnX] = useState<string>("");
  const [columnY, setColumnY] = useState<string>("");
  const [chartType, setChartType] = useState<ChartType>("column");
  const [formula, setFormula] = useState<FormulaType>("compare");
  const [period, setPeriod] = useState<PeriodType>("day");
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<unknown[]>([]);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);

  // 加载数据集列表
  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    try {
      const list = await getDatasets();
      setDatasets(list);
      if (list.length > 0) {
        setSelectedDataset(list[0].id);
        setSelectedHeaders(list[0].headers);
        if (list[0].headers.length >= 2) {
          setColumnX(list[0].headers[0]);
          setColumnY(list[0].headers[1]);
        }
      }
    } catch {
      message.error("加载数据集失败");
    }
  };

  // 当选择数据集变化时，更新列选项
  const handleDatasetChange = async (datasetId: string) => {
    setSelectedDataset(datasetId);
    const dataset = datasets.find((d) => d.id === datasetId);
    if (dataset) {
      setSelectedHeaders(dataset.headers);
      if (dataset.headers.length >= 2) {
        setColumnX(dataset.headers[0]);
        setColumnY(dataset.headers[1]);
      }
    }
  };

  // 生成图表
  const generateChart = async () => {
    if (!selectedDataset || !columnX || !columnY) {
      message.warning("请选择数据集和数据列");
      return;
    }

    setLoading(true);
    try {
      // 判断是否使用时间聚合
      const isTimeAggregation = ["day", "week", "month", "year"].includes(
        formula as string
      );

      if (isTimeAggregation) {
        const response = await aggregate({
          datasetId: selectedDataset,
          dateColumn: columnX,
          valueColumn: columnY,
          period: formula as PeriodType,
        });
        setChartData(response.result.data);
        setSummary(null);
      } else {
        const response = await calculate({
          datasetId: selectedDataset,
          formula,
          columnX,
          columnY,
        });

        if (
          response.result.type === "grouped" ||
          response.result.type === "compare"
        ) {
          setChartData(response.result.data as unknown[]);
        } else if (response.result.type === "distribution") {
          setChartData(response.result.data as unknown[]);
        } else if (response.result.type === "trend") {
          setChartData(response.result.data as unknown[]);
        } else if (response.result.type === "statistics") {
          setChartData(response.result.data as unknown[]);
          setSummary(response.result.summary || null);
        } else {
          // 原始数据
          const dataset = await getDataset(selectedDataset);
          setChartData(
            dataset.rows.map((row) => ({
              x: row[columnX],
              y: Number(row[columnY]) || 0,
            }))
          );
        }
      }

      message.success("图表生成成功");
    } catch {
      message.error("生成图表失败");
    } finally {
      setLoading(false);
    }
  };

  // 渲染图表
  const renderChart = () => {
    if (chartData.length === 0) {
      return <Empty description="暂无数据，请选择数据集并生成图表" />;
    }

    const commonConfig = {
      data: chartData,
      height: 400,
      animation: {
        appear: {
          animation: "fade-in",
          duration: 500,
        },
      },
    };

    switch (chartType) {
      case "line":
        return (
          <Line
            {...commonConfig}
            xField={
              formula === "distribution"
                ? "type"
                : chartData[0] && "period" in (chartData[0] as object)
                ? "period"
                : "x"
            }
            yField={
              chartData[0] && "period" in (chartData[0] as object)
                ? "value"
                : "y"
            }
            smooth
            point={{ size: 4 }}
          />
        );

      case "column":
        return (
          <Column
            {...commonConfig}
            xField={
              formula === "distribution"
                ? "type"
                : chartData[0] && "name" in (chartData[0] as object)
                ? "name"
                : chartData[0] && "category" in (chartData[0] as object)
                ? "category"
                : chartData[0] && "period" in (chartData[0] as object)
                ? "period"
                : "x"
            }
            yField={
              chartData[0] && "period" in (chartData[0] as object)
                ? "value"
                : "value" in (chartData[0] as object)
                ? "value"
                : "y"
            }
            label={{
              position: "top",
            }}
            columnStyle={{
              radius: [4, 4, 0, 0],
            }}
          />
        );

      case "pie":
        return (
          <Pie
            {...commonConfig}
            angleField="value"
            colorField={
              chartData[0] && "type" in (chartData[0] as object)
                ? "type"
                : "name"
            }
            radius={0.8}
            innerRadius={0.5}
            label={{
              type: "spider",
              content: "{name}\n{percentage}",
            }}
            interactions={[{ type: "element-active" }]}
          />
        );

      case "area":
        return (
          <Area
            {...commonConfig}
            xField={
              chartData[0] && "period" in (chartData[0] as object)
                ? "period"
                : "x"
            }
            yField={
              chartData[0] && "period" in (chartData[0] as object)
                ? "value"
                : "y"
            }
            style={{
              fillOpacity: 0.6,
            }}
          />
        );

      default:
        return <Empty description="不支持的图表类型" />;
    }
  };

  const chartTypeOptions = [
    { value: "column", icon: <BarChartOutlined />, label: "柱状图" },
    { value: "line", icon: <LineChartOutlined />, label: "折线图" },
    { value: "pie", icon: <PieChartOutlined />, label: "饼图" },
    { value: "area", icon: <AreaChartOutlined />, label: "面积图" },
  ];

  const formulaOptions = [
    { value: "compare", label: "数据对比" },
    { value: "trend", label: "趋势分析" },
    { value: "distribution", label: "分布占比" },
    { value: "groupSum", label: "分组求和" },
    { value: "groupAvg", label: "分组平均" },
    { value: "statistics", label: "统计汇总" },
  ];

  const periodOptions = [
    { value: "day", label: "按日" },
    { value: "week", label: "按周" },
    { value: "month", label: "按月" },
    { value: "year", label: "按年" },
  ];

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* 配置区域 */}
        <Card bordered={false}>
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <div>
                <Text
                  type="secondary"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  选择数据集
                </Text>
                <Select
                  style={{ width: "100%" }}
                  value={selectedDataset}
                  onChange={handleDatasetChange}
                  placeholder="请选择数据集"
                  options={datasets.map((d) => ({
                    value: d.id,
                    label: `${d.fileName} (${d.rowCount}行)`,
                  }))}
                />
              </div>
            </Col>
            <Col span={6}>
              <div>
                <Text
                  type="secondary"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  X 轴 / 分类列
                </Text>
                <Select
                  style={{ width: "100%" }}
                  value={columnX}
                  onChange={setColumnX}
                  placeholder="选择列"
                  options={selectedHeaders.map((h) => ({ value: h, label: h }))}
                />
              </div>
            </Col>
            <Col span={6}>
              <div>
                <Text
                  type="secondary"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Y 轴 / 数值列
                </Text>
                <Select
                  style={{ width: "100%" }}
                  value={columnY}
                  onChange={setColumnY}
                  placeholder="选择列"
                  options={selectedHeaders.map((h) => ({ value: h, label: h }))}
                />
              </div>
            </Col>
            <Col span={6}>
              <div>
                <Text
                  type="secondary"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  计算公式
                </Text>
                <Select
                  style={{ width: "100%" }}
                  value={formula}
                  onChange={setFormula}
                  options={formulaOptions}
                />
              </div>
            </Col>
          </Row>

          <Divider style={{ margin: "16px 0" }} />

          <Row gutter={[16, 16]} align="middle">
            <Col flex="auto">
              <Space>
                <Text type="secondary">图表类型：</Text>
                <Segmented
                  value={chartType}
                  onChange={(value) => setChartType(value as ChartType)}
                  options={chartTypeOptions.map((opt) => ({
                    value: opt.value,
                    label: (
                      <Space>
                        {opt.icon}
                        {opt.label}
                      </Space>
                    ),
                  }))}
                />
              </Space>
            </Col>
            <Col flex="auto">
              <Space>
                <Text type="secondary">时间维度：</Text>
                <Segmented
                  value={period}
                  onChange={(value) => {
                    setPeriod(value as PeriodType);
                    setFormula(value as FormulaType);
                  }}
                  options={periodOptions}
                />
              </Space>
            </Col>
            <Col>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={loadDatasets}>
                  刷新
                </Button>
                <Button
                  type="primary"
                  onClick={generateChart}
                  loading={loading}
                >
                  生成图表
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 统计汇总 */}
        {summary && (
          <Card bordered={false}>
            <Row gutter={16}>
              <Col span={4}>
                <Statistic title="总和" value={summary.sum} precision={2} />
              </Col>
              <Col span={4}>
                <Statistic
                  title="平均值"
                  value={summary.average}
                  precision={2}
                />
              </Col>
              <Col span={4}>
                <Statistic title="最大值" value={summary.max} precision={2} />
              </Col>
              <Col span={4}>
                <Statistic title="最小值" value={summary.min} precision={2} />
              </Col>
              <Col span={4}>
                <Statistic
                  title="中位数"
                  value={summary.median}
                  precision={2}
                />
              </Col>
              <Col span={4}>
                <Statistic title="数据量" value={summary.count} />
              </Col>
            </Row>
          </Card>
        )}

        {/* 图表区域 */}
        <Card
          bordered={false}
          title={
            <Space>
              <BarChartOutlined />
              <span>数据可视化</span>
            </Space>
          }
        >
          <Spin spinning={loading}>{renderChart()}</Spin>
        </Card>
      </Space>
    </div>
  );
};

export default ChartAnalysis;
