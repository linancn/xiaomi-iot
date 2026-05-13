"use client";

import dynamic from "next/dynamic";
import {
  Activity,
  AirVent,
  Database,
  Gauge,
  Home,
  RadioTower,
  Snowflake,
  ThermometerSun,
  TimerReset,
  Zap,
} from "lucide-react";
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

function formatTime(value: string | null) {
  if (!value) {
    return "无数据";
  }

  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
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

function DeviceRow({ device }: { device: DashboardDevice }) {
  const isAc = device.kind === "air_conditioner";

  return (
    <div className="grid grid-cols-[36px_1fr_auto] items-center gap-3 border-t border-[#e4d9c5] py-3 first:border-t-0">
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
          {device.room} / {device.model ?? "unknown model"} / {formatTime(device.lastSeen)}
        </p>
      </div>
      <div className="text-right">
        {isAc ? (
          <>
            <p className="text-sm font-semibold">{device.acPower ? "运行中" : "待机"}</p>
            <p className="text-xs text-[#716a5e]">{device.setpoint ?? "--"} degC</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold">{device.temperature ?? "--"} degC</p>
            <p className="text-xs text-[#716a5e]">{device.humidity ?? "--"}% RH</p>
          </>
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

export function DashboardShell({ data }: DashboardShellProps) {
  const summaryItems = [
    {
      label: "当前客厅温度",
      value: `${data.summary.currentTemperature.toFixed(1)} degC`,
      icon: ThermometerSun,
      tone: "text-[#e4562e]",
    },
    {
      label: "当前湿度",
      value: `${data.summary.currentHumidity.toFixed(0)}%`,
      icon: Gauge,
      tone: "text-[#1288a8]",
    },
    {
      label: "空调运行数",
      value: String(data.summary.acRunning),
      icon: AirVent,
      tone: "text-[#2f8f62]",
    },
    {
      label: "今日触发",
      value: String(data.summary.todayTriggers),
      icon: Zap,
      tone: "text-[#c28a18]",
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
      <header className="dashboard-shadow grid gap-4 rounded-[8px] border border-[#d8cdb8] bg-[#fffaf0] p-4 md:grid-cols-[1.3fr_0.7fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#716a5e]">
            <Home size={15} />
            Xiaomi Home Climate Ops
          </div>
          <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight sm:text-5xl">
            米家温控联动分析台
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#716a5e] sm:text-base">
            聚合温湿度、空调状态和阈值触发记录，用来判断“超过阈值后自动开空调”
            是否及时、稳定、有效。
          </p>
        </div>
        <div className="grid content-between gap-3 rounded-[8px] bg-[#26221c] p-4 text-[#fffaf0]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#d8cdb8]">Data Source</p>
              <p className="mt-1 text-xl font-black">
                {data.dataSource === "database" ? "TimescaleDB" : "Demo Stream"}
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
                Last 24 Hours
              </p>
              <h2 className="mt-1 text-2xl font-black">温度曲线与阈值</h2>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-[#e4562e] px-3 py-1 text-white">客厅</span>
              <span className="rounded-full bg-[#1288a8] px-3 py-1 text-white">卧室</span>
              <span className="rounded-full bg-[#26221c] px-3 py-1 text-white">阈值 27.5</span>
            </div>
          </div>
          <div className="mt-4 h-[360px] w-full">
            <TemperatureChart series={data.series} />
          </div>
        </div>

        <div className="rounded-[8px] border border-[#d8cdb8] bg-[#fffaf0] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#716a5e]">
                Devices
              </p>
              <h2 className="mt-1 text-2xl font-black">设备状态</h2>
            </div>
            <RadioTower size={24} className="text-[#1288a8]" />
          </div>
          <div className="thin-scrollbar mt-3 max-h-[368px] overflow-auto">
            {data.devices.map((device) => (
              <DeviceRow key={`${device.source}:${device.externalId}`} device={device} />
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
              <h2 className="mt-1 text-2xl font-black">空调运行区间</h2>
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
                Automations
              </p>
              <h2 className="mt-1 text-2xl font-black">阈值触发记录</h2>
            </div>
            <TimerReset size={24} className="text-[#c28a18]" />
          </div>
          <div className="mt-4 overflow-hidden rounded-[8px] border border-[#e4d9c5]">
            <div className="grid grid-cols-[1.1fr_0.8fr_0.9fr_0.7fr] bg-[#26221c] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#fffaf0]">
              <span>时间/房间</span>
              <span>触发值</span>
              <span>目标</span>
              <span className="text-right">降温耗时</span>
            </div>
            {data.automations.map((event) => (
              <div
                key={event.id}
                className="grid grid-cols-[1.1fr_0.8fr_0.9fr_0.7fr] items-center border-t border-[#e4d9c5] px-3 py-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{event.room}</span>
                  <span className="block text-xs text-[#716a5e]">{formatTime(event.occurredAt)}</span>
                </span>
                <span>
                  {event.triggerValue.toFixed(1)} / {event.threshold.toFixed(1)}
                </span>
                <span className="truncate">{event.targetDevice}</span>
                <span className="text-right font-semibold">{event.cooldownMinutes} min</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
