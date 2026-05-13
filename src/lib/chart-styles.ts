export const temperatureChartStyles = {
  temperature: {
    label: "温度",
    detail: "实线",
    color: "#e4562e",
    strokeWidth: 3,
  },
  humidity: {
    label: "湿度",
    detail: "实线",
    color: "#1288a8",
    strokeWidth: 3,
  },
  setTemperature: {
    label: "设定温度",
    detail: "点线",
    color: "#2f8f62",
    strokeWidth: 3,
    strokeDasharray: "1 7",
  },
  currentTemperature: {
    label: "空调当前温度",
    detail: "短虚线",
    color: "#6f4fc4",
    strokeWidth: 3,
    strokeDasharray: "7 5",
  },
  startThreshold: {
    label: "启动阈值",
    detail: "长虚线",
    color: "#c43d2b",
    strokeWidth: 2,
    strokeDasharray: "10 7",
  },
  stopThreshold: {
    label: "停止阈值",
    detail: "长虚线",
    color: "#166f49",
    strokeWidth: 2,
    strokeDasharray: "10 7",
  },
} as const;
