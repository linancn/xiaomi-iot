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
    const dayHeat = Math.sin(angle - 0.8) * 2.1;
    const acCycle = index > 24 && index < 42 ? 1 : index > 10 && index < 15 ? 1 : 0;
    const coolingDrop = acCycle ? 1.4 + Math.sin(index / 3) * 0.3 : 0;
    const temperature = 25.2 + dayHeat - coolingDrop;
    const bedroomTemperature = 24.6 + Math.sin(angle - 0.3) * 1.4 - (index > 30 ? 0.8 : 0);
    const humidity = 48 + Math.cos(angle) * 7 - acCycle * 3;

    return {
      time: isoMinutesAgo(minutesAgo),
      label: new Date(now.getTime() - minutesAgo * 60_000).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      temperature: Number(temperature.toFixed(1)),
      bedroomTemperature: Number(bedroomTemperature.toFixed(1)),
      humidity: Number(humidity.toFixed(0)),
      acOn: acCycle,
      setpoint: acCycle ? 24 : 26,
    };
  });
}

export function buildDemoDevices(): DashboardDevice[] {
  return [
    {
      source: "demo",
      externalId: "sensor.living_room_temperature",
      name: "客厅温湿度计",
      room: "客厅",
      kind: "thermometer",
      model: "miaomiaoce.sensor_ht.t2",
      status: "online",
      lastSeen: isoMinutesAgo(3),
      temperature: 26.3,
      humidity: 45,
      acPower: null,
      setpoint: null,
    },
    {
      source: "demo",
      externalId: "climate.living_room_ac",
      name: "客厅空调",
      room: "客厅",
      kind: "air_conditioner",
      model: "xiaomi.aircondition.mc4",
      status: "online",
      lastSeen: isoMinutesAgo(1),
      temperature: null,
      humidity: null,
      acPower: true,
      setpoint: 24,
    },
    {
      source: "demo",
      externalId: "sensor.bedroom_temperature",
      name: "卧室温湿度计",
      room: "卧室",
      kind: "thermometer",
      model: "lumi.sensor_ht.agl02",
      status: "online",
      lastSeen: isoMinutesAgo(7),
      temperature: 24.9,
      humidity: 52,
      acPower: null,
      setpoint: null,
    },
    {
      source: "demo",
      externalId: "climate.bedroom_ac",
      name: "卧室空调",
      room: "卧室",
      kind: "air_conditioner",
      model: "xiaomi.aircondition.v1",
      status: "stale",
      lastSeen: isoMinutesAgo(34),
      temperature: null,
      humidity: null,
      acPower: false,
      setpoint: 25,
    },
  ];
}

export function buildDemoAutomations(): AutomationEvent[] {
  return [
    {
      id: "demo-1",
      occurredAt: isoMinutesAgo(42),
      room: "客厅",
      triggerMetric: "temperature",
      triggerValue: 27.9,
      threshold: 27.5,
      targetDevice: "客厅空调",
      action: "turn_on",
      result: "success",
      cooldownMinutes: 18,
    },
    {
      id: "demo-2",
      occurredAt: isoMinutesAgo(315),
      room: "卧室",
      triggerMetric: "temperature",
      triggerValue: 26.8,
      threshold: 26.5,
      targetDevice: "卧室空调",
      action: "turn_on",
      result: "success",
      cooldownMinutes: 23,
    },
    {
      id: "demo-3",
      occurredAt: isoMinutesAgo(640),
      room: "客厅",
      triggerMetric: "temperature",
      triggerValue: 28.2,
      threshold: 27.5,
      targetDevice: "客厅空调",
      action: "turn_on",
      result: "success",
      cooldownMinutes: 21,
    },
  ];
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
      averageCooldownMinutes: Math.round(
        automations.reduce((sum, item) => sum + item.cooldownMinutes, 0) / automations.length,
      ),
      comfortScore: 86,
    },
    series,
    devices,
    automations,
  };
}
