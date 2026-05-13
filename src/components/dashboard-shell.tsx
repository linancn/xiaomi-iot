"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import {
  Activity,
  AirVent,
  Battery,
  Clock3,
  Database,
  Droplets,
  Fan,
  Gauge,
  Home,
  RadioTower,
  RefreshCw,
  Snowflake,
  ThermometerSun,
  Wifi,
  Wind,
} from "lucide-react";
import { temperatureChartStyles } from "@/lib/chart-styles";
import type { DashboardData, DashboardDevice } from "@/lib/types";

type DashboardShellProps = {
  data: DashboardData;
};

const statusLabel = {
  connected: "数据库已连接",
  not_configured: "使用演示数据",
  error: "数据库异常",
  empty: "数据库暂无数据",
};

const windowOptions = [
  { label: "1h", hours: 1 },
  { label: "3h", hours: 3 },
  { label: "6h", hours: 6 },
  { label: "12h", hours: 12 },
  { label: "24h", hours: 24 },
  { label: "3d", hours: 72 },
  { label: "7d", hours: 168 },
];

function formatWindowLabel(hours: number) {
  if (hours < 24) {
    return `${hours} 小时`;
  }
  return `${Math.round(hours / 24)} 天`;
}

function formatTime(value: string | null, timeZone: string) {
  if (!value) {
    return "无数据";
  }

  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

function formatMetric(value: number | null, unit: string | null, digits = 1) {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
}

function statusClass(device: DashboardDevice) {
  if (device.status === "online") {
    return "bg-[#2f8f62] text-white";
  }
  if (device.status === "stale") {
    return "bg-[#c28a18] text-[#171615]";
  }
  return "bg-[#26221c] text-white";
}

function LegendItem({
  label,
  detail,
  color,
  dash,
  value,
}: {
  label: string;
  detail: string;
  color: string;
  dash?: string;
  value?: string;
}) {
  return (
    <span className="flex h-8 items-center gap-2 rounded-[8px] border border-[#d8cdb8] bg-[#fffaf0] px-3 text-[#26221c]">
      <svg aria-hidden="true" className="h-3 w-10 shrink-0 overflow-visible">
        <line
          x1="1"
          y1="6"
          x2="39"
          y2="6"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={dash}
          strokeLinecap="round"
        />
      </svg>
      <span className="whitespace-nowrap font-semibold">{value ? `${label} ${value}` : label}</span>
      <span className="whitespace-nowrap text-[#716a5e]">{detail}</span>
    </span>
  );
}

function DeviceRow({ device, timeZone }: { device: DashboardDevice; timeZone: string }) {
  const isAc = device.kind === "air_conditioner";
  const changedAt = device.lastChanged ?? device.lastSeen;

  return (
    <div className="grid grid-cols-[36px_1fr] gap-3 border-t border-[#e4d9c5] py-3 first:border-t-0">
      <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#26221c] text-[#fffaf0]">
        {isAc ? <Snowflake size={17} /> : <ThermometerSun size={17} />}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold">{device.name}</p>
          <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusClass(device)}`}>
            {device.status}
          </span>
        </div>
        <p className="mt-1 text-xs text-[#716a5e]">
          {device.room} / {device.model ?? "unknown model"} / 更新 {formatTime(device.lastSeen, timeZone)}
        </p>

        {isAc ? (
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <span>开关：{device.acPower ? "运行中" : "关闭"}</span>
            <span>模式：{device.hvacMode ?? "--"}</span>
            <span>设定：{formatMetric(device.setTemperature, device.temperatureUnit)}</span>
            <span>当前：{formatMetric(device.currentTemperature, device.temperatureUnit)}</span>
            <span>风速：{device.fanMode ?? "--"}</span>
            <span>扫风：{device.swingMode ?? "--"}</span>
            <span className="sm:col-span-2">最近变化：{formatTime(changedAt, timeZone)}</span>
          </div>
        ) : (
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <span>温度：{formatMetric(device.temperature, device.temperatureUnit)}</span>
            <span>湿度：{formatMetric(device.humidity, device.humidityUnit, 0)}</span>
            <span>电量：{formatMetric(device.battery, "%", 0)}</span>
            <span>信号：{formatMetric(device.rssi, "dBm", 0)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ChartPlaceholder() {
  return (
    <div className="flex h-full min-h-full items-center justify-center rounded-[8px] border border-dashed border-[#d8cdb8] bg-[#f8efdf] text-sm font-semibold text-[#716a5e]">
      Loading chart
    </div>
  );
}

const TemperatureChart = dynamic(
  () => import("./climate-charts").then((module) => module.TemperatureChart),
  { ssr: false, loading: ChartPlaceholder },
);

const RuntimeChart = dynamic(
  () => import("./climate-charts").then((module) => module.RuntimeChart),
  { ssr: false, loading: ChartPlaceholder },
);

export function DashboardShell({ data: initialData }: DashboardShellProps) {
  const [data, setData] = useState(initialData);
  const [isLoadingWindow, setIsLoadingWindow] = useState(false);
  const [windowError, setWindowError] = useState<string | null>(null);
  const thermometer = data.devices.find((device) => device.kind === "thermometer");
  const airConditioner = data.devices.find((device) => device.kind === "air_conditioner");
  const sourceName = data.dataSource === "database" ? "Home Assistant" : "Demo fallback";
  const storageName = data.dataSource === "database" ? "TimescaleDB" : "Local demo";
  const temperatureUnit = thermometer?.temperatureUnit ?? airConditioner?.temperatureUnit ?? "°C";
  const timeZone = data.timeWindow.timeZone;

  async function loadWindow(hours: number) {
    setIsLoadingWindow(true);
    setWindowError(null);

    try {
      const response = await fetch(`/api/dashboard?hours=${hours}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const nextData = (await response.json()) as DashboardData;
      setData(nextData);
      window.history.replaceState(null, "", `?hours=${nextData.timeWindow.hours}`);
    } catch (error) {
      setWindowError(error instanceof Error ? error.message : "窗口数据加载失败");
    } finally {
      setIsLoadingWindow(false);
    }
  }

  const summaryItems = [
    {
      label: "Jing 大屋温度",
      value: formatMetric(data.summary.currentTemperature, temperatureUnit),
      icon: ThermometerSun,
      tone: "text-[#e4562e]",
    },
    {
      label: "Jing 大屋湿度",
      value: formatMetric(data.summary.currentHumidity, "%", 0),
      icon: Droplets,
      tone: "text-[#1288a8]",
    },
    {
      label: "空调状态",
      value: airConditioner?.acPower ? "运行中" : "关闭",
      icon: AirVent,
      tone: "text-[#2f8f62]",
    },
    {
      label: "控制阈值",
      value: `${data.thresholds.stopTemperature}停 / ${data.thresholds.startTemperature}启`,
      icon: Gauge,
      tone: "text-[#6f4fc4]",
    },
  ];

  const analysisItems = [
    {
      label: "窗口最高温",
      value: formatMetric(data.summary.maxTemperature, temperatureUnit),
    },
    {
      label: "窗口最低温",
      value: formatMetric(data.summary.minTemperature, temperatureUnit),
    },
    {
      label: "平均温度",
      value: formatMetric(data.summary.averageTemperature, temperatureUnit),
    },
    {
      label: "空调运行占比",
      value: data.summary.acRuntimePercent === null ? "--" : `${data.summary.acRuntimePercent}%`,
    },
    {
      label: "聚合粒度",
      value: `${data.timeWindow.bucketMinutes} 分钟`,
    },
    {
      label: "时间点",
      value: String(data.summary.sampleCount),
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
      <header className="dashboard-shadow grid gap-4 rounded-[8px] border border-[#d8cdb8] bg-[#fffaf0] p-4 md:grid-cols-[1.25fr_0.75fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#716a5e]">
            <Home size={15} />
            Xiaomi Home / Home Assistant
          </div>
          <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight sm:text-5xl">
            Jing 大屋米家数据分析台
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#716a5e] sm:text-base">
            当前只展示米家智能温湿度计机房与空调 巨省电Pro 1.5匹 超一级能效 2；用于观察实时状态和分析 25°C 停、28°C 启的控制策略。
          </p>
        </div>
        <div className="grid content-between gap-3 rounded-[8px] bg-[#26221c] p-4 text-[#fffaf0]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#d8cdb8]">Data Source</p>
              <p className="mt-1 text-xl font-black">{sourceName}</p>
              <p className="mt-1 text-sm text-[#d8cdb8]">
                {storageName} / {timeZone}
              </p>
            </div>
            <Database className="text-[#f0b84a]" size={27} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-[8px] border border-[#5b5144] p-3">
              <p className="text-[#d8cdb8]">状态</p>
              <p className="mt-1 font-semibold">{statusLabel[data.databaseStatus]}</p>
            </div>
            <div className="rounded-[8px] border border-[#5b5144] p-3">
              <p className="text-[#d8cdb8]">舒适分</p>
              <p className="mt-1 font-semibold">{data.summary.comfortScore}/100</p>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-[8px] border border-[#d8cdb8] bg-[#fffaf0] p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-[#716a5e]">{item.label}</p>
                <Icon className={item.tone} size={22} />
              </div>
              <p className="mt-3 text-3xl font-black">{item.value}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="rounded-[8px] border border-[#d8cdb8] bg-[#fffaf0] p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#716a5e]">
                Window / {timeZone}
              </p>
              <h2 className="mt-1 text-2xl font-black">
                近 {formatWindowLabel(data.timeWindow.hours)} 温湿度趋势
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              {windowOptions.map((option) => {
                const isActive = option.hours === data.timeWindow.hours;
                return (
                  <button
                    key={option.hours}
                    type="button"
                    onClick={() => void loadWindow(option.hours)}
                    disabled={isLoadingWindow}
                    className={`h-8 rounded-[8px] border px-3 font-semibold transition ${
                      isActive
                        ? "border-[#26221c] bg-[#26221c] text-[#fffaf0]"
                        : "border-[#d8cdb8] bg-[#fffaf0] text-[#26221c] hover:bg-[#f4ead9]"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {option.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => void loadWindow(data.timeWindow.hours)}
                disabled={isLoadingWindow}
                className="flex h-8 items-center gap-1 rounded-[8px] border border-[#d8cdb8] bg-[#fffaf0] px-3 font-semibold text-[#26221c] hover:bg-[#f4ead9] disabled:cursor-not-allowed disabled:opacity-60"
                title="刷新当前窗口"
              >
                <RefreshCw size={14} />
                刷新
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <LegendItem
              label={temperatureChartStyles.temperature.label}
              detail={temperatureChartStyles.temperature.detail}
              color={temperatureChartStyles.temperature.color}
            />
            <LegendItem
              label={temperatureChartStyles.humidity.label}
              detail={temperatureChartStyles.humidity.detail}
              color={temperatureChartStyles.humidity.color}
            />
            <LegendItem
              label={temperatureChartStyles.setTemperature.label}
              detail={temperatureChartStyles.setTemperature.detail}
              color={temperatureChartStyles.setTemperature.color}
              dash={temperatureChartStyles.setTemperature.strokeDasharray}
            />
            <LegendItem
              label={temperatureChartStyles.currentTemperature.label}
              detail={temperatureChartStyles.currentTemperature.detail}
              color={temperatureChartStyles.currentTemperature.color}
              dash={temperatureChartStyles.currentTemperature.strokeDasharray}
            />
            <LegendItem
              label="启动"
              detail={temperatureChartStyles.startThreshold.detail}
              color={temperatureChartStyles.startThreshold.color}
              dash={temperatureChartStyles.startThreshold.strokeDasharray}
              value={`${data.thresholds.startTemperature}°C`}
            />
            <LegendItem
              label="停止"
              detail={temperatureChartStyles.stopThreshold.detail}
              color={temperatureChartStyles.stopThreshold.color}
              dash={temperatureChartStyles.stopThreshold.strokeDasharray}
              value={`${data.thresholds.stopTemperature}°C`}
            />
            {windowError ? <span className="text-[#c43d2b]">窗口加载失败：{windowError}</span> : null}
          </div>
          <div className="mt-4 h-[360px] w-full">
            <TemperatureChart
              series={data.series}
              stopTemperature={data.thresholds.stopTemperature}
              startTemperature={data.thresholds.startTemperature}
            />
          </div>
        </div>

        <div className="rounded-[8px] border border-[#d8cdb8] bg-[#fffaf0] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#716a5e]">
                Devices
              </p>
              <h2 className="mt-1 text-2xl font-black">目标设备</h2>
            </div>
            <RadioTower size={24} className="text-[#1288a8]" />
          </div>
          <div className="thin-scrollbar mt-3 max-h-[430px] overflow-auto">
            {data.devices.map((device) => (
              <DeviceRow key={`${device.source}:${device.externalId}`} device={device} timeZone={timeZone} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[8px] border border-[#d8cdb8] bg-[#fffaf0] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#716a5e]">
                AC Runtime
              </p>
              <h2 className="mt-1 text-2xl font-black">空调开关状态</h2>
            </div>
            <Activity size={24} className="text-[#2f8f62]" />
          </div>
          <div className="mt-4 h-[230px]">
            <RuntimeChart series={data.series} />
          </div>
        </div>

        <div className="rounded-[8px] border border-[#d8cdb8] bg-[#fffaf0] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#716a5e]">
                Snapshot
              </p>
              <h2 className="mt-1 text-2xl font-black">最新状态</h2>
            </div>
            <Gauge size={24} className="text-[#c28a18]" />
          </div>

          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div className="border-t border-[#e4d9c5] pt-3">
              <div className="flex items-center gap-2 font-semibold">
                <ThermometerSun size={17} className="text-[#e4562e]" />
                温湿度计
              </div>
              <div className="mt-3 grid gap-2">
                <span>温度：{formatMetric(thermometer?.temperature ?? null, temperatureUnit)}</span>
                <span>湿度：{formatMetric(thermometer?.humidity ?? null, "%", 0)}</span>
                <span className="flex items-center gap-2">
                  <Battery size={15} />
                  {formatMetric(thermometer?.battery ?? null, "%", 0)}
                </span>
                <span className="flex items-center gap-2">
                  <Wifi size={15} />
                  {formatMetric(thermometer?.rssi ?? null, "dBm", 0)}
                </span>
                <span>更新时间：{formatTime(thermometer?.lastSeen ?? null, timeZone)}</span>
              </div>
            </div>

            <div className="border-t border-[#e4d9c5] pt-3">
              <div className="flex items-center gap-2 font-semibold">
                <Snowflake size={17} className="text-[#1288a8]" />
                空调
              </div>
              <div className="mt-3 grid gap-2">
                <span>开关：{airConditioner?.acPower ? "运行中" : "关闭"}</span>
                <span>模式：{airConditioner?.hvacMode ?? "--"}</span>
                <span>设定：{formatMetric(airConditioner?.setTemperature ?? null, temperatureUnit)}</span>
                <span>当前：{formatMetric(airConditioner?.currentTemperature ?? null, temperatureUnit)}</span>
                <span className="flex items-center gap-2">
                  <Fan size={15} />
                  {airConditioner?.fanMode ?? "--"}
                </span>
                <span className="flex items-center gap-2">
                  <Wind size={15} />
                  {airConditioner?.swingMode ?? "--"}
                </span>
                <span>
                  最近变化：
                  {formatTime(airConditioner?.lastChanged ?? airConditioner?.lastSeen ?? null, timeZone)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[8px] border border-[#d8cdb8] bg-[#fffaf0] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#716a5e]">
              Historical Analysis
            </p>
            <h2 className="mt-1 text-2xl font-black">策略分析窗口</h2>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#716a5e]">
            <Clock3 size={17} />
            {formatTime(data.timeWindow.start, timeZone)} - {formatTime(data.timeWindow.end, timeZone)}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {analysisItems.map((item) => (
            <div key={item.label} className="border-t border-[#e4d9c5] pt-3">
              <p className="text-xs font-semibold text-[#716a5e]">{item.label}</p>
              <p className="mt-2 text-xl font-black">{item.value}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
