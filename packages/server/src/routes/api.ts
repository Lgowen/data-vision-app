import { Router, Request, Response } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import path from "path";
import fs from "fs";
import os from "os";
import type { ParsedData, CalculationResult } from "@data-vision/shared";

const router = Router();

// 获取上传目录
const getUploadDir = (): string => {
  const uploadDir = path.join(os.tmpdir(), "data-vision-uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, getUploadDir());
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const originalName = Buffer.from(file.originalname, "latin1").toString(
      "utf8"
    );
    cb(null, uniqueSuffix + "-" + originalName);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [".csv", ".xlsx", ".xls"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("只支持 CSV、XLSX、XLS 格式的文件"));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// 解析上传的文件
const parseFile = (filePath: string, originalName: string): ParsedData => {
  const ext = path.extname(originalName).toLowerCase();
  let headers: string[] = [];
  let rows: Record<string, unknown>[] = [];

  if (ext === ".csv") {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const result = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });
    headers = result.meta.fields || [];
    rows = result.data as Record<string, unknown>[];
  } else {
    // Excel 文件
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
    }) as unknown[][];

    if (jsonData.length > 0) {
      headers = (jsonData[0] as unknown[]).map(String);
      rows = jsonData.slice(1).map((row) => {
        const obj: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          obj[header] = (row as unknown[])[index];
        });
        return obj;
      });
    }
  }

  return {
    headers,
    rows,
    fileName: originalName,
    uploadTime: new Date().toISOString(),
  };
};

// 存储已上传的数据集
const datasets: Map<string, ParsedData> = new Map();

// 健康检查
router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 上传文件
router.post("/upload", upload.single("file"), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "请选择要上传的文件" });
    }

    const parsedData = parseFile(req.file.path, req.file.originalname);
    const datasetId = Date.now().toString();
    datasets.set(datasetId, parsedData);

    res.json({
      success: true,
      datasetId,
      data: parsedData,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "文件解析失败" });
  }
});

// 获取所有数据集列表
router.get("/datasets", (_req: Request, res: Response) => {
  const list = Array.from(datasets.entries()).map(([id, data]) => ({
    id,
    fileName: data.fileName,
    uploadTime: data.uploadTime,
    rowCount: data.rows.length,
    headers: data.headers,
  }));
  res.json(list);
});

// 获取单个数据集
router.get("/datasets/:id", (req: Request, res: Response) => {
  const dataset = datasets.get(req.params.id);
  if (!dataset) {
    return res.status(404).json({ error: "数据集不存在" });
  }
  res.json(dataset);
});

// 删除数据集
router.delete("/datasets/:id", (req: Request, res: Response) => {
  const deleted = datasets.delete(req.params.id);
  res.json({ success: deleted });
});

// 内置公式计算
const calculateFormula = (
  rows: Record<string, unknown>[],
  formula: string,
  columnX: string,
  columnY: string
): CalculationResult => {
  const yValues = rows.map((r) => Number(r[columnY]) || 0);

  switch (formula) {
    case "sum":
      return {
        type: "single",
        data: yValues.reduce((a, b) => a + b, 0),
      };

    case "average":
      return {
        type: "single",
        data: yValues.reduce((a, b) => a + b, 0) / yValues.length,
      };

    case "max":
      return {
        type: "single",
        data: Math.max(...yValues),
      };

    case "min":
      return {
        type: "single",
        data: Math.min(...yValues),
      };

    case "groupSum": {
      const grouped: Record<string, number> = {};
      rows.forEach((row) => {
        const key = String(row[columnX]);
        grouped[key] = (grouped[key] || 0) + (Number(row[columnY]) || 0);
      });
      return {
        type: "grouped",
        data: Object.entries(grouped).map(([name, value]) => ({ name, value })),
      };
    }

    case "groupAvg": {
      const groupedSum: Record<string, number> = {};
      const groupedCount: Record<string, number> = {};
      rows.forEach((row) => {
        const key = String(row[columnX]);
        groupedSum[key] = (groupedSum[key] || 0) + (Number(row[columnY]) || 0);
        groupedCount[key] = (groupedCount[key] || 0) + 1;
      });
      return {
        type: "grouped",
        data: Object.entries(groupedSum).map(([name, sum]) => ({
          name,
          value: sum / groupedCount[name],
        })),
      };
    }

    case "trend": {
      return {
        type: "trend",
        data: rows.map((row) => ({
          x: row[columnX],
          y: Number(row[columnY]) || 0,
        })),
      };
    }

    case "compare": {
      return {
        type: "compare",
        data: rows.map((row) => ({
          category: row[columnX],
          value: Number(row[columnY]) || 0,
        })),
      };
    }

    case "distribution": {
      const total = yValues.reduce((a, b) => a + b, 0);
      return {
        type: "distribution",
        data: rows.map((row) => ({
          type: String(row[columnX]),
          value: Number(row[columnY]) || 0,
          percent: ((Number(row[columnY]) || 0) / total) * 100,
        })),
      };
    }

    case "statistics": {
      const sum = yValues.reduce((a, b) => a + b, 0);
      const avg = sum / yValues.length;
      const sorted = [...yValues].sort((a, b) => a - b);
      const median =
        sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];

      return {
        type: "statistics",
        data: rows.map((row) => ({
          x: row[columnX],
          y: Number(row[columnY]) || 0,
        })),
        summary: {
          sum,
          average: avg,
          max: Math.max(...yValues),
          min: Math.min(...yValues),
          median,
          count: yValues.length,
        },
      };
    }

    default:
      return {
        type: "raw",
        data: rows,
      };
  }
};

// 计算公式
router.post("/calculate", (req: Request, res: Response) => {
  try {
    const { datasetId, formula, columnX, columnY } = req.body;
    const dataset = datasets.get(datasetId);

    if (!dataset) {
      return res.status(404).json({ error: "数据集不存在" });
    }

    const result = calculateFormula(dataset.rows, formula, columnX, columnY);
    res.json({ success: true, result });
  } catch (error) {
    console.error("Calculate error:", error);
    res.status(500).json({ error: "计算失败" });
  }
});

// 按时间周期聚合
const aggregateByPeriod = (
  rows: Record<string, unknown>[],
  dateColumn: string,
  valueColumn: string,
  period: "day" | "week" | "month" | "year"
): { data: { period: string; value: number }[] } => {
  const grouped: Record<string, number[]> = {};

  rows.forEach((row) => {
    const dateValue = row[dateColumn];
    if (!dateValue) return;

    const date = new Date(String(dateValue));
    if (isNaN(date.getTime())) return;

    let key: string;
    switch (period) {
      case "day":
        key = date.toISOString().split("T")[0];
        break;
      case "week": {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = `${weekStart.toISOString().split("T")[0]} 周`;
        break;
      }
      case "month":
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
        break;
      case "year":
        key = String(date.getFullYear());
        break;
    }

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(Number(row[valueColumn]) || 0);
  });

  const data = Object.entries(grouped)
    .map(([period, values]) => ({
      period,
      value: values.reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return { data };
};

// 时间维度聚合
router.post("/aggregate", (req: Request, res: Response) => {
  try {
    const { datasetId, dateColumn, valueColumn, period } = req.body;
    const dataset = datasets.get(datasetId);

    if (!dataset) {
      return res.status(404).json({ error: "数据集不存在" });
    }

    const result = aggregateByPeriod(
      dataset.rows,
      dateColumn,
      valueColumn,
      period
    );
    res.json({ success: true, result });
  } catch (error) {
    console.error("Aggregate error:", error);
    res.status(500).json({ error: "聚合计算失败" });
  }
});

// 多数据集对比
router.post("/compare-datasets", (req: Request, res: Response) => {
  try {
    const { datasetIds, valueColumn, labelColumn } = req.body;

    const comparisonData = datasetIds
      .map((id: string) => {
        const dataset = datasets.get(id);
        if (!dataset) return null;

        const sum = dataset.rows.reduce(
          (acc, row) => acc + (Number(row[valueColumn]) || 0),
          0
        );
        return {
          datasetId: id,
          fileName: dataset.fileName,
          total: sum,
          rowCount: dataset.rows.length,
          data: dataset.rows.map((row) => ({
            label: row[labelColumn],
            value: Number(row[valueColumn]) || 0,
          })),
        };
      })
      .filter(Boolean);

    res.json({ success: true, result: comparisonData });
  } catch (error) {
    console.error("Compare error:", error);
    res.status(500).json({ error: "对比计算失败" });
  }
});

export { router as apiRouter };
