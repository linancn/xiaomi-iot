import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const SOURCE = "home-assistant";
const INGEST_SCOPE = "jing_da_wu_two_devices";
const TARGET_AREA_NAME = "Jing大屋";
const TARGET_DEVICES = [
  {
    name: "米家智能温湿度计机房",
    kind: "thermometer",
    expectedMetrics: ["temperature", "humidity", "battery", "signal/rssi"],
  },
  {
    name: "空调 巨省电Pro 1.5匹 超一级能效 2",
    kind: "air_conditioner",
    expectedMetrics: [
      "power",
      "hvac_mode",
      "set_temperature",
      "current_temperature",
      "fan_mode",
      "swing_mode",
    ],
  },
];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, raw] = match;
    let value = raw.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required. Add it to .env.local.`);
  }
  return value;
}

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .trim();
}

function deviceName(device) {
  return device.name_by_user || device.name || device.original_name || device.model || device.id;
}

function entityDomain(entityId) {
  return entityId.split(".", 1)[0] ?? "";
}

function stateAttributes(state) {
  return state?.attributes && typeof state.attributes === "object" ? state.attributes : {};
}

function numericState(state) {
  if (!state || state.state === "unknown" || state.state === "unavailable") {
    return null;
  }

  const value = Number(state.state);
  return Number.isFinite(value) ? value : null;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundMetric(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return value;
  }
  return Number(value.toFixed(digits));
}

function isFahrenheitUnit(unit) {
  return unit === "°F" || unit === "degF" || unit === "F";
}

function inferClimateTemperatureUnit(attributes) {
  const minTemp = numberOrNull(attributes.min_temp);
  const maxTemp = numberOrNull(attributes.max_temp);
  if (minTemp !== null && maxTemp !== null && minTemp >= 45 && maxTemp >= 80) {
    return "°F";
  }
  return "°C";
}

function normalizeTemperature(value, unit) {
  if (value === null) {
    return { value: null, unit };
  }

  if (isFahrenheitUnit(unit)) {
    return { value: roundMetric(((value - 32) * 5) / 9), unit: "°C" };
  }

  return { value: roundMetric(value), unit: unit || "°C" };
}

async function fetchHomeAssistantJson(baseUrl, token, endpoint) {
  const response = await fetch(new URL(endpoint, baseUrl), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return { ok: response.ok, status: response.status, body };
}

async function fetchRegistryViaWebSocket(baseUrl, token) {
  if (!globalThis.WebSocket) {
    throw new Error("Node.js global WebSocket is unavailable; use a Node version with WebSocket support.");
  }

  const wsUrl = new URL("/api/websocket", baseUrl);
  wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";

  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let nextId = 1;
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Timed out while reading Home Assistant registries."));
    }, 15_000);

    function send(type) {
      const id = nextId;
      nextId += 1;
      ws.send(JSON.stringify({ id, type }));

      return new Promise((commandResolve, commandReject) => {
        pending.set(id, { resolve: commandResolve, reject: commandReject, type });
      });
    }

    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "auth_required") {
        ws.send(JSON.stringify({ type: "auth", access_token: token }));
        return;
      }

      if (message.type === "auth_invalid") {
        clearTimeout(timeout);
        ws.close();
        reject(new Error("Home Assistant WebSocket authentication failed."));
        return;
      }

      if (message.type === "auth_ok") {
        Promise.all([
          send("config/entity_registry/list"),
          send("config/device_registry/list"),
          send("config/area_registry/list"),
        ])
          .then(([entityMessage, deviceMessage, areaMessage]) => {
            clearTimeout(timeout);
            ws.close();

            if (!entityMessage.success || !deviceMessage.success || !areaMessage.success) {
              reject(new Error("Home Assistant registry command returned an error."));
              return;
            }

            resolve({
              entities: entityMessage.result,
              devices: deviceMessage.result,
              areas: areaMessage.result,
            });
          })
          .catch((error) => {
            clearTimeout(timeout);
            ws.close();
            reject(error);
          });
        return;
      }

      if (typeof message.id === "number" && pending.has(message.id)) {
        pending.get(message.id).resolve(message);
        pending.delete(message.id);
      }
    });

    ws.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("Failed to connect to Home Assistant WebSocket API."));
    });
  });
}

async function fetchRegistries(baseUrl, token) {
  const endpoints = {
    entities: "/api/config/entity_registry/list",
    devices: "/api/config/device_registry/list",
    areas: "/api/config/area_registry/list",
  };

  const registries = {};
  for (const [key, endpoint] of Object.entries(endpoints)) {
    const result = await fetchHomeAssistantJson(baseUrl, token, endpoint);
    if (!result.ok) {
      console.log(`${endpoint}: status=${result.status}; falling back to Home Assistant WebSocket API.`);
      return await fetchRegistryViaWebSocket(baseUrl, token);
    }
    registries[key] = result.body;
  }

  return registries;
}

function findTargetArea(areas) {
  const area = areas.find((item) => normalizeName(item.name) === normalizeName(TARGET_AREA_NAME));
  if (!area) {
    const areaNames = areas.map((item) => item.name).join(", ");
    throw new Error(`Target area ${TARGET_AREA_NAME} was not found. Available areas: ${areaNames}`);
  }
  return area;
}

function findTargetDevices(devices, area) {
  const areaDevices = devices.filter((device) => device.area_id === area.area_id);
  const matches = [];

  for (const target of TARGET_DEVICES) {
    const match = areaDevices.find((device) => {
      const names = [device.name_by_user, device.name, device.original_name].filter(Boolean);
      return names.includes(target.name);
    });

    if (!match) {
      const available = areaDevices.map(deviceName).join(", ");
      throw new Error(`Target device ${target.name} was not found in ${area.name}. Available: ${available}`);
    }

    matches.push({ ...target, device: match });
  }

  return matches;
}

function entityMetadata(entity, state) {
  const attributes = stateAttributes(state);
  return {
    entity_id: entity.entity_id,
    friendly_name: attributes.friendly_name ?? entity.name ?? entity.original_name ?? null,
    device_class: attributes.device_class ?? entity.device_class ?? null,
    state_class: attributes.state_class ?? null,
    unit_of_measurement: attributes.unit_of_measurement ?? null,
    platform: entity.platform ?? null,
    disabled_by: entity.disabled_by ?? null,
    last_changed: state?.last_changed ?? null,
    last_updated: state?.last_updated ?? null,
  };
}

function buildRaw({ target, area, entity, state, metric, originalUnit, value }) {
  return {
    source: SOURCE,
    ingest_scope: INGEST_SCOPE,
    metric,
    value,
    area_id: area.area_id,
    area_name: area.name,
    device_id: target.device.id,
    device_name: target.name,
    kind: target.kind,
    model: target.device.model ?? null,
    manufacturer: target.device.manufacturer ?? null,
    entity: entityMetadata(entity, state),
    entity_id: entity.entity_id,
    friendly_name: entityMetadata(entity, state).friendly_name,
    device_class: entityMetadata(entity, state).device_class,
    state_class: entityMetadata(entity, state).state_class,
    unit_of_measurement: originalUnit ?? null,
    ha_state: state?.state ?? null,
    ha_last_changed: state?.last_changed ?? null,
    ha_last_updated: state?.last_updated ?? null,
  };
}

function buildPoint({ target, area, entity, state, metric, value, unit, observedAt, originalUnit }) {
  const numericValue = typeof value === "number" && Number.isFinite(value) ? value : null;

  return {
    observedAt,
    source: SOURCE,
    externalId: target.device.id,
    metric,
    valueDouble: numericValue,
    valueText: String(value),
    unit: unit ?? null,
    raw: buildRaw({ target, area, entity, state, metric, originalUnit, value }),
  };
}

function findEntity(deviceEntities, statesByEntityId, predicate) {
  return deviceEntities
    .map((entity) => ({ entity, state: statesByEntityId.get(entity.entity_id) }))
    .find(({ entity, state }) => state && predicate(entity, state));
}

function collectThermometerPoints(target, area, deviceEntities, statesByEntityId, observedAt) {
  const points = [];
  const found = new Set();

  const temperature = findEntity(deviceEntities, statesByEntityId, (entity, state) => {
    const attributes = stateAttributes(state);
    return entityDomain(entity.entity_id) === "sensor" && attributes.device_class === "temperature";
  });

  if (temperature) {
    const originalUnit = stateAttributes(temperature.state).unit_of_measurement ?? null;
    const normalized = normalizeTemperature(numericState(temperature.state), originalUnit);
    if (normalized.value !== null) {
      found.add("temperature");
      points.push(
        buildPoint({
          target,
          area,
          entity: temperature.entity,
          state: temperature.state,
          metric: "temperature",
          value: normalized.value,
          unit: normalized.unit,
          observedAt,
          originalUnit,
        }),
      );
    }
  }

  const humidity = findEntity(deviceEntities, statesByEntityId, (entity, state) => {
    const attributes = stateAttributes(state);
    return entityDomain(entity.entity_id) === "sensor" && attributes.device_class === "humidity";
  });

  if (humidity) {
    const value = numericState(humidity.state);
    if (value !== null) {
      found.add("humidity");
      points.push(
        buildPoint({
          target,
          area,
          entity: humidity.entity,
          state: humidity.state,
          metric: "humidity",
          value: roundMetric(value, 1),
          unit: stateAttributes(humidity.state).unit_of_measurement ?? "%",
          observedAt,
          originalUnit: stateAttributes(humidity.state).unit_of_measurement ?? null,
        }),
      );
    }
  }

  const battery = findEntity(deviceEntities, statesByEntityId, (entity, state) => {
    const attributes = stateAttributes(state);
    return entityDomain(entity.entity_id) === "sensor" && attributes.device_class === "battery";
  });

  if (battery) {
    const value = numericState(battery.state);
    if (value !== null) {
      found.add("battery");
      points.push(
        buildPoint({
          target,
          area,
          entity: battery.entity,
          state: battery.state,
          metric: "battery",
          value: roundMetric(value, 1),
          unit: stateAttributes(battery.state).unit_of_measurement ?? "%",
          observedAt,
          originalUnit: stateAttributes(battery.state).unit_of_measurement ?? null,
        }),
      );
    }
  }

  const signal = findEntity(deviceEntities, statesByEntityId, (entity, state) => {
    const attributes = stateAttributes(state);
    const haystack = `${entity.entity_id} ${attributes.friendly_name ?? ""}`.toLowerCase();
    return (
      entityDomain(entity.entity_id) === "sensor" &&
      (attributes.device_class === "signal_strength" ||
        attributes.unit_of_measurement === "dBm" ||
        haystack.includes("rssi") ||
        haystack.includes("signal") ||
        haystack.includes("信号"))
    );
  });

  if (signal) {
    const value = numericState(signal.state);
    if (value !== null) {
      found.add("signal/rssi");
      points.push(
        buildPoint({
          target,
          area,
          entity: signal.entity,
          state: signal.state,
          metric: "rssi",
          value: roundMetric(value, 1),
          unit: stateAttributes(signal.state).unit_of_measurement ?? "dBm",
          observedAt,
          originalUnit: stateAttributes(signal.state).unit_of_measurement ?? null,
        }),
      );
    }
  }

  return { points, missing: target.expectedMetrics.filter((metric) => !found.has(metric)) };
}

function collectAirConditionerPoints(target, area, deviceEntities, statesByEntityId, observedAt) {
  const points = [];
  const found = new Set();
  const climate = findEntity(deviceEntities, statesByEntityId, (entity) => {
    return entityDomain(entity.entity_id) === "climate";
  });

  if (!climate) {
    return { points, missing: target.expectedMetrics };
  }

  const attributes = stateAttributes(climate.state);
  const temperatureUnit = inferClimateTemperatureUnit(attributes);
  const state = climate.state.state;
  const powerValue = state && state !== "unknown" && state !== "unavailable" && state !== "off" ? 1 : 0;
  found.add("power");
  found.add("hvac_mode");
  points.push(
    buildPoint({
      target,
      area,
      entity: climate.entity,
      state: climate.state,
      metric: "ac_power",
      value: powerValue,
      unit: "bool",
      observedAt,
      originalUnit: null,
    }),
    buildPoint({
      target,
      area,
      entity: climate.entity,
      state: climate.state,
      metric: "hvac_mode",
      value: state,
      unit: null,
      observedAt,
      originalUnit: null,
    }),
  );

  const setTemperature = normalizeTemperature(numberOrNull(attributes.temperature), temperatureUnit);
  if (setTemperature.value !== null) {
    found.add("set_temperature");
    points.push(
      buildPoint({
        target,
        area,
        entity: climate.entity,
        state: climate.state,
        metric: "set_temperature",
        value: setTemperature.value,
        unit: setTemperature.unit,
        observedAt,
        originalUnit: temperatureUnit,
      }),
    );
  }

  const currentTemperature = normalizeTemperature(numberOrNull(attributes.current_temperature), temperatureUnit);
  if (currentTemperature.value !== null) {
    found.add("current_temperature");
    points.push(
      buildPoint({
        target,
        area,
        entity: climate.entity,
        state: climate.state,
        metric: "current_temperature",
        value: currentTemperature.value,
        unit: currentTemperature.unit,
        observedAt,
        originalUnit: temperatureUnit,
      }),
    );
  }

  if (attributes.fan_mode) {
    found.add("fan_mode");
    points.push(
      buildPoint({
        target,
        area,
        entity: climate.entity,
        state: climate.state,
        metric: "fan_mode",
        value: attributes.fan_mode,
        unit: null,
        observedAt,
        originalUnit: null,
      }),
    );
  }

  if (attributes.swing_mode) {
    found.add("swing_mode");
    points.push(
      buildPoint({
        target,
        area,
        entity: climate.entity,
        state: climate.state,
        metric: "swing_mode",
        value: attributes.swing_mode,
        unit: null,
        observedAt,
        originalUnit: null,
      }),
    );
  }

  if (numberOrNull(attributes.current_humidity) !== null) {
    points.push(
      buildPoint({
        target,
        area,
        entity: climate.entity,
        state: climate.state,
        metric: "current_humidity",
        value: roundMetric(numberOrNull(attributes.current_humidity), 1),
        unit: "%",
        observedAt,
        originalUnit: "%",
      }),
    );
  }

  return { points, missing: target.expectedMetrics.filter((metric) => !found.has(metric)) };
}

async function upsertDevice(client, target, area, selectedEntityIds) {
  await client.query(
    `
      INSERT INTO devices (
        source, external_id, name, room, kind, model, metadata, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
      ON CONFLICT (source, external_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        room = EXCLUDED.room,
        kind = EXCLUDED.kind,
        model = EXCLUDED.model,
        metadata = devices.metadata || EXCLUDED.metadata,
        updated_at = NOW()
    `,
    [
      SOURCE,
      target.device.id,
      target.name,
      area.name,
      target.kind,
      target.device.model ?? null,
      JSON.stringify({
        ingest_scope: INGEST_SCOPE,
        ha_device_id: target.device.id,
        area_id: area.area_id,
        area_name: area.name,
        manufacturer: target.device.manufacturer ?? null,
        model: target.device.model ?? null,
        selected_entity_ids: selectedEntityIds,
      }),
    ],
  );
}

async function insertTelemetryPoints(client, points) {
  for (const point of points) {
    await client.query(
      `
        INSERT INTO telemetry_points (
          observed_at, source, external_id, metric, value_double, value_text, unit, raw
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        ON CONFLICT (observed_at, source, external_id, metric)
        DO UPDATE SET
          value_double = EXCLUDED.value_double,
          value_text = EXCLUDED.value_text,
          unit = EXCLUDED.unit,
          raw = EXCLUDED.raw
      `,
      [
        point.observedAt,
        point.source,
        point.externalId,
        point.metric,
        point.valueDouble,
        point.valueText,
        point.unit,
        JSON.stringify(point.raw),
      ],
    );
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));

const databaseUrl = requireEnv("DATABASE_URL");
const homeAssistantUrl = requireEnv("HOME_ASSISTANT_URL");
const homeAssistantToken = requireEnv("HOME_ASSISTANT_TOKEN");
const observedAt = new Date();

const statesResult = await fetchHomeAssistantJson(homeAssistantUrl, homeAssistantToken, "/api/states");
if (!statesResult.ok) {
  throw new Error(`/api/states returned status ${statesResult.status}.`);
}

const states = statesResult.body;
const { entities, devices, areas } = await fetchRegistries(homeAssistantUrl, homeAssistantToken);
const statesByEntityId = new Map(states.map((state) => [state.entity_id, state]));
const area = findTargetArea(areas);
const targets = findTargetDevices(devices, area);
const pool = new pg.Pool({ connectionString: databaseUrl });
const client = await pool.connect();
const missingByDevice = [];
let insertedPoints = 0;

console.log(
  `Home Assistant data loaded: states=${states.length}, entities=${entities.length}, devices=${devices.length}, areas=${areas.length}.`,
);
console.log(`Target area: ${area.name} (${area.area_id}).`);

try {
  await client.query("BEGIN");

  for (const target of targets) {
    const deviceEntities = entities.filter((entity) => entity.device_id === target.device.id);
    const collected =
      target.kind === "thermometer"
        ? collectThermometerPoints(target, area, deviceEntities, statesByEntityId, observedAt)
        : collectAirConditionerPoints(target, area, deviceEntities, statesByEntityId, observedAt);

    await upsertDevice(
      client,
      target,
      area,
      collected.points.map((point) => point.raw.entity_id),
    );
    await insertTelemetryPoints(client, collected.points);

    insertedPoints += collected.points.length;
    if (collected.missing.length > 0) {
      missingByDevice.push({ name: target.name, metrics: collected.missing });
    }

    console.log(
      `${target.name}: collected ${collected.points.length}/${target.expectedMetrics.length} expected metric groups.`,
    );
  }

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}

console.log(`Inserted telemetry points: ${insertedPoints}.`);
if (missingByDevice.length > 0) {
  console.log("未识别到的期望指标:");
  for (const item of missingByDevice) {
    console.log(`- ${item.name}: ${item.metrics.join(", ")}`);
  }
} else {
  console.log("未识别到的期望指标: 无");
}
