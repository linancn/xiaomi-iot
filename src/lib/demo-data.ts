import type {
  AutomationEvent,
  DashboardData,
  DashboardDevice,
  DatabaseStatus,
  TelemetryPoint,
} from "./types";

const now = new Date("2026-05-13T12:00:00+08:00");

function isoMinutesAgo(minutes: number) {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

export function buildDemoSeries(): TelemetryPoint[] {
  return Array.from({ length: 49 }, (_, index) => {
    const minutesAgo = (48 - index) * 30;
    const angle = (index / 48) * Math.PI * 2;
    const dayHeat = Math.sin(angle - 0.8) * 1.8;
    const acCycle = index > 24 && index < 42 ? 1 : index > 10 && index < 15 ? 1 : 0;
    const coolingDrop = acCycle ? 1.2 + Math.sin(index / 3) * 0.25 : 0;
    const temperature = 24.5 + dayHeat - coolingDrop;
    const currentTemperature = 25.1 + Math.sin(angle - 0.4) * 1.2 - acCycle * 0.9;
    const humidity = 46 + Math.cos(angle) * 6 - acCycle * 2;

    return {
      time: isoMinutesAgo(minutesAgo),
      label: new Date(now.getTime() - minutesAgo * 60_000).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
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

export function buildDemoDashboardData(databaseStatus: DatabaseStatus = "not_configured"): DashboardData {
  const series = buildDemoSeries();
  const devices = buildDemoDevices();
  const automations = buildDemoAutomations();
  const latest = series.at(-1);

  return {
    generatedAt: new Date().toISOString(),
    dataSource: "demo",
    databaseStatus,
    summary: {
      currentTemperature: latest?.temperature ?? 0,
      currentHumidity: latest?.humidity ?? 0,
      acRunning: devices.filter((device) => device.acPower).length,
      todayTriggers: automations.length,
      averageCooldownMinutes: automations.length
        ? Math.round(automations.reduce((sum, item) => sum + item.cooldownMinutes, 0) / automations.length)
        : 0,
      comfortScore: 86,
    },
    series,
    devices,
    automations,
  };
}
