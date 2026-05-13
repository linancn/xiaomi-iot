import { getPool } from "./db";
import { buildDemoDashboardData } from "./demo-data";
import type {
  AutomationEvent,
  ControlThresholds,
  DashboardData,
  DashboardDevice,
  DatabaseStatus,
  DashboardTimeWindow,
  DeviceKind,
  TelemetryPoint,
} from "./types";

const TARGET_SCOPE = "jing_da_wu_two_devices";
const TARGET_DEVICE_NAMES = ["米家智能温湿度计机房", "空调 巨省电Pro 1.5匹 超一级能效 2"];
const DEFAULT_TIME_ZONE = "Asia/Shanghai";
const DEFAULT_WINDOW_HOURS = 3;
const MIN_WINDOW_HOURS = 1;
const MAX_WINDOW_HOURS = 24 * 30;
const THRESHOLDS: ControlThresholds = {
  stopTemperature: 25,
  startTemperature: 28,
};

export type DashboardQueryOptions = {
  hours?: number;
};

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

export function normalizeDashboardHours(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_WINDOW_HOURS;
  }

  return Math.max(MIN_WINDOW_HOURS, Math.min(MAX_WINDOW_HOURS, parsed));
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

function buildTimeWindow(hours: number, bucketMinutes: number): DashboardTimeWindow {
  const end = new Date();

  return {
    hours,
    bucketMinutes,
    start: new Date(end.getTime() - hours * 60 * 60_000).toISOString(),
    end: end.toISOString(),
    timeZone: DEFAULT_TIME_ZONE,
  };
}

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

function formatSeriesLabel(value: Date, hours: number) {
  return value.toLocaleString("zh-CN", {
    month: hours > 24 ? "2-digit" : undefined,
    day: hours > 24 ? "2-digit" : undefined,
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DEFAULT_TIME_ZONE,
  });
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

function toSeriesPoint(row: SeriesRow, hours: number): TelemetryPoint {
  const date = new Date(row.bucket);

  return {
    time: date.toISOString(),
    label: formatSeriesLabel(date, hours),
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

async function fetchDatabaseData(options: Required<DashboardQueryOptions>): Promise<DashboardData | null> {
  const pool = getPool();
  if (!pool) {
    return null;
  }

  const hours = normalizeDashboardHours(options.hours);
  const bucketMinutes = bucketMinutesForHours(hours);
  const timeWindow = buildTimeWindow(hours, bucketMinutes);
  const windowSeconds = Math.round(hours * 60 * 60);
  const bucketInterval = `${bucketMinutes} minutes`;

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
          time_bucket($3::interval, tp.observed_at) AS bucket,
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
        WHERE tp.observed_at >= NOW() - ($4::int * INTERVAL '1 second')
          AND tp.value_double IS NOT NULL
        GROUP BY bucket
        ORDER BY bucket
      `,
      [TARGET_SCOPE, TARGET_DEVICE_NAMES, bucketInterval, windowSeconds],
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

  if (deviceResult.rowCount === 0) {
    return null;
  }

  const devices = deviceResult.rows.map(toDashboardDevice);
  const series = seriesResult.rows.map((row) => toSeriesPoint(row, hours));
  const automations = automationResult.rows.map(toAutomation);
  const thermometer = devices.find((device) => device.kind === "thermometer");
  const acRunning = devices.filter((device) => device.acPower).length;
  const todayStart = new Date(
    new Date().toLocaleDateString("en-CA", { timeZone: DEFAULT_TIME_ZONE }) + "T00:00:00+08:00",
  );
  const temperature = thermometer?.temperature ?? series.at(-1)?.temperature ?? 0;
  const humidity = thermometer?.humidity ?? series.at(-1)?.humidity ?? 0;
  const cooldowns = automations.map((item) => item.cooldownMinutes);
  const temperatureValues = series
    .map((point) => point.temperature)
    .filter((value): value is number => value !== null);
  const acSamples = series.map((point) => point.acOn).filter((value): value is number => value !== null);

  return {
    generatedAt: new Date().toISOString(),
    dataSource: "database",
    databaseStatus: "connected",
    timeWindow,
    thresholds: THRESHOLDS,
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
      minTemperature: temperatureValues.length ? roundMetric(Math.min(...temperatureValues)) : null,
      maxTemperature: temperatureValues.length ? roundMetric(Math.max(...temperatureValues)) : null,
      averageTemperature: temperatureValues.length
        ? roundMetric(temperatureValues.reduce((sum, value) => sum + value, 0) / temperatureValues.length)
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

export async function getDashboardData(options: DashboardQueryOptions = {}): Promise<DashboardData> {
  const pool = getPool();
  let status: DatabaseStatus = pool ? "error" : "not_configured";
  const hours = normalizeDashboardHours(options.hours);

  try {
    const data = await fetchDatabaseData({ hours });
    if (data) {
      return data;
    }
    status = pool ? "empty" : "not_configured";
  } catch {
    status = "error";
  }

  return buildDemoDashboardData(status, hours);
}
