"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
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
        <YAxis tick={{ fill: "#716a5e", fontSize: 12 }} domain={[20, 31]} />
        <Tooltip
          contentStyle={{
            background: "#fffaf0",
            border: "1px solid #d8cdb8",
            borderRadius: 8,
          }}
        />
        <ReferenceLine
          y={27.5}
          stroke="#26221c"
          strokeDasharray="5 5"
          label={{ value: "trigger", fill: "#26221c", fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="temperature"
          name="客厅温度"
          stroke="#e4562e"
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="bedroomTemperature"
          name="卧室温度"
          stroke="#1288a8"
          strokeWidth={3}
          dot={false}
        />
        <Line
          type="stepAfter"
          dataKey="setpoint"
          name="设定温度"
          stroke="#2f8f62"
          strokeWidth={2}
          dot={false}
          strokeDasharray="3 6"
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
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
