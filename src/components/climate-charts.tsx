"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TelemetryPoint } from "@/lib/types";

export function TemperatureChart({ series }: { series: TelemetryPoint[] }) {
  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      minWidth={0}
      minHeight={0}
      initialDimension={{ width: 900, height: 360 }}
    >
      <LineChart data={series} margin={{ top: 16, right: 18, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="#e2d6c1" strokeDasharray="4 4" />
        <XAxis dataKey="label" tick={{ fill: "#716a5e", fontSize: 12 }} />
        <YAxis
          yAxisId="temperature"
          tick={{ fill: "#716a5e", fontSize: 12 }}
          domain={[18, 32]}
          unit="°C"
        />
        <YAxis
          yAxisId="humidity"
          orientation="right"
          tick={{ fill: "#716a5e", fontSize: 12 }}
          domain={[0, 100]}
          unit="%"
        />
        <Tooltip
          contentStyle={{
            background: "#fffaf0",
            border: "1px solid #d8cdb8",
            borderRadius: 8,
          }}
        />
        <Line
          yAxisId="temperature"
          type="monotone"
          dataKey="temperature"
          name="温湿度计温度"
          stroke="#e4562e"
          strokeWidth={3}
          dot={false}
          connectNulls
          activeDot={{ r: 5 }}
        />
        <Line
          yAxisId="humidity"
          type="monotone"
          dataKey="humidity"
          name="湿度"
          stroke="#1288a8"
          strokeWidth={3}
          dot={false}
          connectNulls
        />
        <Line
          yAxisId="temperature"
          type="stepAfter"
          dataKey="setTemperature"
          name="设定温度"
          stroke="#2f8f62"
          strokeWidth={2}
          dot={false}
          strokeDasharray="3 6"
          connectNulls
        />
        <Line
          yAxisId="temperature"
          type="monotone"
          dataKey="currentTemperature"
          name="空调当前温度"
          stroke="#6f4fc4"
          strokeWidth={2}
          dot={false}
          strokeDasharray="8 5"
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RuntimeChart({ series }: { series: TelemetryPoint[] }) {
  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      minWidth={0}
      minHeight={0}
      initialDimension={{ width: 520, height: 230 }}
    >
      <AreaChart data={series} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="acOnFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2f8f62" stopOpacity={0.65} />
            <stop offset="95%" stopColor="#2f8f62" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#e2d6c1" strokeDasharray="4 4" />
        <XAxis dataKey="label" tick={{ fill: "#716a5e", fontSize: 12 }} />
        <YAxis hide domain={[0, 1]} />
        <Tooltip
          contentStyle={{
            background: "#fffaf0",
            border: "1px solid #d8cdb8",
            borderRadius: 8,
          }}
        />
        <Area
          type="stepAfter"
          dataKey="acOn"
          name="运行"
          stroke="#2f8f62"
          fill="url(#acOnFill)"
          strokeWidth={2}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
