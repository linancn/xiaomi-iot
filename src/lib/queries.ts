import { getPool } from "./db";
import { buildDemoDashboardData } from "./demo-data";
import type {
  AutomationEvent,
  DashboardData,
  DashboardDevice,
  DatabaseStatus,
  DeviceKind,
  TelemetryPoint,
} from "./types";

type DeviceRow = {
  source: string;
  external_id: string;
  name: string | null;
  room: string | null;
  kind: DeviceKind;
  model: string | null;
  last_seen: string | null;
  temperature: number | null;
  humidity: number | null;
  ac_power: number | null;
  setpoint: number | null;
};

type SeriesRow = {
  bucket: string;
  temperature: number | null;
  bedroom_temperature: number | null;
  humidity: number | null;
  ac_on: number | null;
  setpoint: number | null;
};

type AutomationRow = {
  id: string;
  occurred_at: string;
  room: string;
  trigger_metric: string;
  trigger_value: number;
  threshold: number;
  target_device: string;
  action: string;
  result: "success" | "failed" | "pending";
  cooldown_minutes: number;
};

function deviceStatus(lastSeen: string | null): DashboardDevice["status"] {
  if (!lastSeen) {
    return "offline";
  }

  const ageMs = Date.now() - new Date(lastSeen).getTime();
  if (ageMs < 15 * 60_000) {
    return "online";
  }
  if (ageMs < 2 * 60 * 60_000) {
    return "stale";
  }
  return "offline";
}

function roundMetric(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null;
  }
  return Number(Number(value).toFixed(digits));
}

function toDashboardDevice(row: DeviceRow): DashboardDevice {
  return {
    source: row.source,
    externalId: row.external_id,
    name: row.name ?? row.external_id,
    room: row.room ?? "未分区",
    kind: row.kind,
    model: row.model,
    status: deviceStatus(row.last_seen),
    lastSeen: row.last_seen,
    temperature: roundMetric(row.temperature),
    humidity: roundMetric(row.humidity, 0),
    acPower: row.ac_power === null ? null : row.ac_power > 0,
    setpoint: roundMetric(row.setpoint),
  };
}

function toSeriesPoint(row: SeriesRow): TelemetryPoint {
  const date = new Date(row.bucket);

  return {
    time: date.toISOString(),
    label: date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    temperature: roundMetric(row.temperature) ?? 0,
    bedroomTemperature: roundMetric(row.bedroom_temperature) ?? 0,
    humidity: roundMetric(row.humidity, 0) ?? 0,
    acOn: row.ac_on ?? 0,
    setpoint: roundMetric(row.setpoint) ?? 0,
  };
}

function toAutomation(row: AutomationRow): AutomationEvent {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    room: row.room,
    triggerMetric: row.trigger_metric,
    triggerValue: Number(row.trigger_value),
    threshold: Number(row.threshold),
    targetDevice: row.target_device,
    action: row.action,
    result: row.result,
    cooldownMinutes: Number(row.cooldown_minutes),
  };
}

async function fetchDatabaseData(): Promise<DashboardData | null> {
  const pool = getPool();
  if (!pool) {
    return null;
  }

  const [deviceResult, seriesResult, automationResult] = await Promise.all([
    pool.query<DeviceRow>(`
      SELECT
        d.source,
        d.external_id,
        d.name,
        d.room,
        d.kind,
        d.model,
        MAX(latest.observed_at)::text AS last_seen,
        MAX(latest.value_double) FILTER (WHERE latest.metric = 'temperature') AS temperature,
        MAX(latest.value_double) FILTER (WHERE latest.metric = 'humidity') AS humidity,
        MAX(latest.value_double) FILTER (WHERE latest.metric IN ('ac_power', 'power')) AS ac_power,
        MAX(latest.value_double) FILTER (WHERE latest.metric IN ('setpoint', 'target_temperature')) AS setpoint
      FROM devices d
      LEFT JOIN LATERAL (
        SELECT DISTINCT ON (metric)
          metric,
          value_double,
          observed_at
        FROM telemetry_points tp
        WHERE tp.source = d.source
          AND tp.external_id = d.external_id
        ORDER BY metric, observed_at DESC
      ) latest ON TRUE
      GROUP BY d.source, d.external_id, d.name, d.room, d.kind, d.model
      ORDER BY d.room NULLS LAST, d.kind, d.name
    `),
    pool.query<SeriesRow>(`
      SELECT
        time_bucket('30 minutes', observed_at) AS bucket,
        AVG(value_double) FILTER (
          WHERE metric = 'temperature' AND external_id ILIKE '%living%'
        ) AS temperature,
        AVG(value_double) FILTER (
          WHERE metric = 'temperature' AND external_id ILIKE '%bedroom%'
        ) AS bedroom_temperature,
        AVG(value_double) FILTER (WHERE metric = 'humidity') AS humidity,
        MAX(value_double) FILTER (WHERE metric IN ('ac_power', 'power')) AS ac_on,
        AVG(value_double) FILTER (WHERE metric IN ('setpoint', 'target_temperature')) AS setpoint
      FROM telemetry_points
      WHERE observed_at >= NOW() - INTERVAL '24 hours'
        AND value_double IS NOT NULL
      GROUP BY bucket
      ORDER BY bucket
    `),
    pool.query<AutomationRow>(`
      SELECT
        id::text,
        occurred_at::text,
        room,
        trigger_metric,
        trigger_value,
        threshold,
        target_device,
        action,
        result,
        cooldown_minutes
      FROM automation_events
      WHERE occurred_at >= NOW() - INTERVAL '7 days'
      ORDER BY occurred_at DESC
      LIMIT 12
    `),
  ]);

  if (deviceResult.rowCount === 0 || seriesResult.rowCount === 0) {
    return null;
  }

  const devices = deviceResult.rows.map(toDashboardDevice);
  const series = seriesResult.rows.map(toSeriesPoint);
  const automations = automationResult.rows.map(toAutomation);
  const latest = series.at(-1);
  const cooldowns = automations.map((item) => item.cooldownMinutes);
  const acRunning = devices.filter((device) => device.acPower).length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return {
    generatedAt: new Date().toISOString(),
    dataSource: "database",
    databaseStatus: "connected",
    summary: {
      currentTemperature: latest?.temperature ?? 0,
      currentHumidity: latest?.humidity ?? 0,
      acRunning,
      todayTriggers: automations.filter((item) => new Date(item.occurredAt) >= todayStart).length,
      averageCooldownMinutes: cooldowns.length
        ? Math.round(cooldowns.reduce((sum, value) => sum + value, 0) / cooldowns.length)
        : 0,
      comfortScore: Math.max(
        0,
        Math.min(
          100,
          Math.round(100 - Math.abs((latest?.temperature ?? 25) - 25) * 8 - acRunning * 3),
        ),
      ),
    },
    series,
    devices,
    automations,
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const pool = getPool();
  let status: DatabaseStatus = pool ? "error" : "not_configured";

  try {
    const data = await fetchDatabaseData();
    if (data) {
      return data;
    }
    status = pool ? "empty" : "not_configured";
  } catch {
    status = "error";
  }

  return buildDemoDashboardData(status);
}
