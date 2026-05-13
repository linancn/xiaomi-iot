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

const TARGET_SCOPE = "jing_da_wu_two_devices";
const TARGET_DEVICE_NAMES = ["米家智能温湿度计机房", "空调 巨省电Pro 1.5匹 超一级能效 2"];

type DeviceRow = {
  source: string;
  external_id: string;
  name: string | null;
  room: string | null;
  kind: DeviceKind;
  model: string | null;
  last_seen: string | null;
  last_changed: string | null;
  temperature: number | null;
  humidity: number | null;
  battery: number | null;
  rssi: number | null;
  ac_power: number | null;
  hvac_mode: string | null;
  set_temperature: number | null;
  current_temperature: number | null;
  fan_mode: string | null;
  swing_mode: string | null;
  temperature_unit: string | null;
  humidity_unit: string | null;
};

type SeriesRow = {
  bucket: string;
  temperature: number | null;
  humidity: number | null;
  ac_on: number | null;
  set_temperature: number | null;
  current_temperature: number | null;
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
    lastChanged: row.last_changed,
    temperature: roundMetric(row.temperature),
    humidity: roundMetric(row.humidity, 0),
    battery: roundMetric(row.battery, 0),
    rssi: roundMetric(row.rssi, 0),
    acPower: row.ac_power === null ? null : row.ac_power > 0,
    hvacMode: row.hvac_mode,
    setTemperature: roundMetric(row.set_temperature),
    currentTemperature: roundMetric(row.current_temperature),
    fanMode: row.fan_mode,
    swingMode: row.swing_mode,
    temperatureUnit: row.temperature_unit,
    humidityUnit: row.humidity_unit,
  };
}

function toSeriesPoint(row: SeriesRow): TelemetryPoint {
  const date = new Date(row.bucket);

  return {
    time: date.toISOString(),
    label: date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    temperature: roundMetric(row.temperature),
    humidity: roundMetric(row.humidity, 0),
    acOn: row.ac_on === null ? null : Number(row.ac_on),
    setTemperature: roundMetric(row.set_temperature),
    currentTemperature: roundMetric(row.current_temperature),
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

  const targetDevicesSql = `
    SELECT *
    FROM devices
    WHERE source = 'home-assistant'
      AND (
        metadata ->> 'ingest_scope' = $1
        OR (
          name = ANY($2::text[])
          AND regexp_replace(COALESCE(room, ''), '\\s+', '', 'g') = 'Jing大屋'
        )
      )
  `;

  const [deviceResult, seriesResult, automationResult] = await Promise.all([
    pool.query<DeviceRow>(
      `
        WITH target_devices AS (${targetDevicesSql})
        SELECT
          d.source,
          d.external_id,
          d.name,
          d.room,
          d.kind,
          d.model,
          MAX(latest.observed_at)::text AS last_seen,
          MAX(NULLIF(latest.raw ->> 'ha_last_changed', '')::timestamptz)::text AS last_changed,
          MAX(latest.value_double) FILTER (WHERE latest.metric = 'temperature') AS temperature,
          MAX(latest.value_double) FILTER (WHERE latest.metric = 'humidity') AS humidity,
          MAX(latest.value_double) FILTER (WHERE latest.metric = 'battery') AS battery,
          MAX(latest.value_double) FILTER (WHERE latest.metric = 'rssi') AS rssi,
          MAX(latest.value_double) FILTER (WHERE latest.metric IN ('ac_power', 'power')) AS ac_power,
          MAX(latest.value_text) FILTER (WHERE latest.metric = 'hvac_mode') AS hvac_mode,
          MAX(latest.value_double) FILTER (
            WHERE latest.metric IN ('set_temperature', 'setpoint', 'target_temperature')
          ) AS set_temperature,
          MAX(latest.value_double) FILTER (WHERE latest.metric = 'current_temperature') AS current_temperature,
          MAX(latest.value_text) FILTER (WHERE latest.metric = 'fan_mode') AS fan_mode,
          MAX(latest.value_text) FILTER (WHERE latest.metric = 'swing_mode') AS swing_mode,
          MAX(latest.unit) FILTER (
            WHERE latest.metric IN ('temperature', 'set_temperature', 'current_temperature')
          ) AS temperature_unit,
          MAX(latest.unit) FILTER (WHERE latest.metric = 'humidity') AS humidity_unit
        FROM target_devices d
        LEFT JOIN LATERAL (
          SELECT DISTINCT ON (metric)
            metric,
            value_double,
            value_text,
            unit,
            raw,
            observed_at
          FROM telemetry_points tp
          WHERE tp.source = d.source
            AND tp.external_id = d.external_id
          ORDER BY metric, observed_at DESC
        ) latest ON TRUE
        GROUP BY d.source, d.external_id, d.name, d.room, d.kind, d.model
        ORDER BY
          CASE d.kind WHEN 'thermometer' THEN 1 WHEN 'air_conditioner' THEN 2 ELSE 3 END,
          d.name
      `,
      [TARGET_SCOPE, TARGET_DEVICE_NAMES],
    ),
    pool.query<SeriesRow>(
      `
        WITH target_devices AS (${targetDevicesSql})
        SELECT
          time_bucket('10 minutes', tp.observed_at) AS bucket,
          AVG(tp.value_double) FILTER (
            WHERE d.kind = 'thermometer' AND tp.metric = 'temperature'
          ) AS temperature,
          AVG(tp.value_double) FILTER (
            WHERE d.kind = 'thermometer' AND tp.metric = 'humidity'
          ) AS humidity,
          MAX(tp.value_double) FILTER (
            WHERE d.kind = 'air_conditioner' AND tp.metric IN ('ac_power', 'power')
          ) AS ac_on,
          AVG(tp.value_double) FILTER (
            WHERE d.kind = 'air_conditioner'
              AND tp.metric IN ('set_temperature', 'setpoint', 'target_temperature')
          ) AS set_temperature,
          AVG(tp.value_double) FILTER (
            WHERE d.kind = 'air_conditioner' AND tp.metric = 'current_temperature'
          ) AS current_temperature
        FROM target_devices d
        JOIN telemetry_points tp
          ON tp.source = d.source
          AND tp.external_id = d.external_id
        WHERE tp.observed_at >= NOW() - INTERVAL '24 hours'
          AND tp.value_double IS NOT NULL
        GROUP BY bucket
        ORDER BY bucket
      `,
      [TARGET_SCOPE, TARGET_DEVICE_NAMES],
    ),
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
      WHERE regexp_replace(room, '\\s+', '', 'g') = 'Jing大屋'
        AND occurred_at >= NOW() - INTERVAL '7 days'
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
  const thermometer = devices.find((device) => device.kind === "thermometer");
  const acRunning = devices.filter((device) => device.acPower).length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const temperature = thermometer?.temperature ?? series.at(-1)?.temperature ?? 0;
  const humidity = thermometer?.humidity ?? series.at(-1)?.humidity ?? 0;
  const cooldowns = automations.map((item) => item.cooldownMinutes);

  return {
    generatedAt: new Date().toISOString(),
    dataSource: "database",
    databaseStatus: "connected",
    summary: {
      currentTemperature: temperature,
      currentHumidity: humidity,
      acRunning,
      todayTriggers: automations.filter((item) => new Date(item.occurredAt) >= todayStart).length,
      averageCooldownMinutes: cooldowns.length
        ? Math.round(cooldowns.reduce((sum, value) => sum + value, 0) / cooldowns.length)
        : 0,
      comfortScore: Math.max(
        0,
        Math.min(100, Math.round(100 - Math.abs((temperature ?? 25) - 24) * 7 - acRunning * 3)),
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
