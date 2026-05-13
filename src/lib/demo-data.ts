import type {
  AutomationEvent,
  ControlThresholds,
  DashboardData,
  DashboardDevice,
  DatabaseStatus,
  DashboardTimeWindow,
  TelemetryPoint,
} from "./types";

const now = new Date("2026-05-13T12:00:00+08:00");
const DEFAULT_TIME_ZONE = "Asia/Shanghai";
const THRESHOLDS: ControlThresholds = {
  stopTemperature: 25,
  startTemperature: 28,
};

function formatLabel(value: Date) {
  return value.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DEFAULT_TIME_ZONE,
  });
}

function bucketMinutesForHours(hours: number) {
  if (hours <= 3) {
    return 5;
  }
  if (hours <= 12) {
    return 10;
  }
  if (hours <= 48) {
    return 30;
  }
  if (hours <= 168) {
    return 60;
  }
  return 360;
}

function buildTimeWindow(hours: number): DashboardTimeWindow {
  const bucketMinutes = bucketMinutesForHours(hours);

  return {
    hours,
    bucketMinutes,
    start: new Date(now.getTime() - hours * 60 * 60_000).toISOString(),
    end: now.toISOString(),
    timeZone: DEFAULT_TIME_ZONE,
  };
}

function isoMinutesAgo(minutes: number) {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

export function buildDemoSeries(hours = 3): TelemetryPoint[] {
  const bucketMinutes = bucketMinutesForHours(hours);
  const pointCount = Math.max(2, Math.min(160, Math.floor((hours * 60) / bucketMinutes) + 1));

  return Array.from({ length: pointCount }, (_, index) => {
    const minutesAgo = (pointCount - 1 - index) * bucketMinutes;
    const angle = (index / Math.max(1, pointCount - 1)) * Math.PI * 2;
    const dayHeat = Math.sin(angle - 0.8) * 1.8;
    const acCycle = index > 24 && index < 42 ? 1 : index > 10 && index < 15 ? 1 : 0;
    const coolingDrop = acCycle ? 1.2 + Math.sin(index / 3) * 0.25 : 0;
    const temperature = 24.5 + dayHeat - coolingDrop;
    const currentTemperature = 25.1 + Math.sin(angle - 0.4) * 1.2 - acCycle * 0.9;
    const humidity = 46 + Math.cos(angle) * 6 - acCycle * 2;

    return {
      time: isoMinutesAgo(minutesAgo),
      label: formatLabel(new Date(now.getTime() - minutesAgo * 60_000)),
      temperature: Number(temperature.toFixed(1)),
      humidity: Number(humidity.toFixed(0)),
      acOn: acCycle,
      setTemperature: acCycle ? 23 : 24.5,
      currentTemperature: Number(currentTemperature.toFixed(1)),
    };
  });
}

export function buildDemoDevices(): DashboardDevice[] {
  return [
    {
      source: "demo",
      externalId: "sensor.miaomiaoc_cn_blt_3_1p0d5sv5cc001_t9_temperature_p_3_1001",
      name: "米家智能温湿度计机房",
      room: "Jing 大屋",
      kind: "thermometer",
      model: "miaomiaoce.sensor_ht.t9",
      status: "online",
      lastSeen: isoMinutesAgo(3),
      lastChanged: isoMinutesAgo(3),
      temperature: 26.3,
      humidity: 45,
      battery: 100,
      rssi: null,
      acPower: null,
      hvacMode: null,
      setTemperature: null,
      currentTemperature: null,
      fanMode: null,
      swingMode: null,
      temperatureUnit: "°C",
      humidityUnit: "%",
    },
    {
      source: "demo",
      externalId: "climate.xiaomi_cn_928741871_h39h00",
      name: "空调 巨省电Pro 1.5匹 超一级能效 2",
      room: "Jing 大屋",
      kind: "air_conditioner",
      model: "xiaomi.airc.h39h00",
      status: "online",
      lastSeen: isoMinutesAgo(1),
      lastChanged: isoMinutesAgo(18),
      temperature: null,
      humidity: null,
      battery: null,
      rssi: null,
      acPower: false,
      hvacMode: "off",
      setTemperature: 22,
      currentTemperature: 25.6,
      fanMode: "自动",
      swingMode: "vertical",
      temperatureUnit: "°C",
      humidityUnit: null,
    },
  ];
}

export function buildDemoAutomations(): AutomationEvent[] {
  return [];
}

export function buildDemoDashboardData(
  databaseStatus: DatabaseStatus = "not_configured",
  hours = 3,
): DashboardData {
  const series = buildDemoSeries(hours);
  const devices = buildDemoDevices();
  const automations = buildDemoAutomations();
  const latest = series.at(-1);
  const temperatureValues = series
    .map((point) => point.temperature)
    .filter((value): value is number => value !== null);
  const acSamples = series
    .map((point) => point.acOn)
    .filter((value): value is number => value !== null);

  return {
    generatedAt: new Date().toISOString(),
    dataSource: "demo",
    databaseStatus,
    timeWindow: buildTimeWindow(hours),
    thresholds: THRESHOLDS,
    summary: {
      currentTemperature: latest?.temperature ?? 0,
      currentHumidity: latest?.humidity ?? 0,
      acRunning: devices.filter((device) => device.acPower).length,
      todayTriggers: automations.length,
      averageCooldownMinutes: automations.length
        ? Math.round(automations.reduce((sum, item) => sum + item.cooldownMinutes, 0) / automations.length)
        : 0,
      comfortScore: 86,
      minTemperature: temperatureValues.length ? Math.min(...temperatureValues) : null,
      maxTemperature: temperatureValues.length ? Math.max(...temperatureValues) : null,
      averageTemperature: temperatureValues.length
        ? Number((temperatureValues.reduce((sum, value) => sum + value, 0) / temperatureValues.length).toFixed(1))
        : null,
      sampleCount: series.length,
      acRuntimePercent: acSamples.length
        ? Math.round((acSamples.filter((value) => value > 0).length / acSamples.length) * 100)
        : null,
    },
    series,
    devices,
    automations,
  };
}
