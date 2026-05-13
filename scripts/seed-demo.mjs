import pg from "pg";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://xiaomi_iot:xiaomi_iot_password@localhost:5432/xiaomi_iot";

const pool = new pg.Pool({ connectionString: databaseUrl });
const now = new Date();

function minutesAgo(minutes) {
  return new Date(now.getTime() - minutes * 60_000);
}

const devices = [
  ["home-assistant", "sensor.living_room_temperature", "客厅温湿度计", "客厅", "thermometer", "miaomiaoce.sensor_ht.t2"],
  ["home-assistant", "climate.living_room_ac", "客厅空调", "客厅", "air_conditioner", "xiaomi.aircondition.mc4"],
  ["home-assistant", "sensor.bedroom_temperature", "卧室温湿度计", "卧室", "thermometer", "lumi.sensor_ht.agl02"],
  ["home-assistant", "climate.bedroom_ac", "卧室空调", "卧室", "air_conditioner", "xiaomi.aircondition.v1"],
];

try {
  await pool.query("TRUNCATE automation_events, telemetry_points, devices RESTART IDENTITY");

  for (const device of devices) {
    await pool.query(
      `
        INSERT INTO devices (source, external_id, name, room, kind, model)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      device,
    );
  }

  for (let index = 0; index < 49; index += 1) {
    const minutes = (48 - index) * 30;
    const observedAt = minutesAgo(minutes);
    const angle = (index / 48) * Math.PI * 2;
    const livingAcOn = index > 24 && index < 42 ? 1 : index > 10 && index < 15 ? 1 : 0;
    const bedroomAcOn = index > 30 ? 1 : 0;
    const livingTemperature = 25.2 + Math.sin(angle - 0.8) * 2.1 - livingAcOn * 1.4;
    const bedroomTemperature = 24.6 + Math.sin(angle - 0.3) * 1.4 - bedroomAcOn * 0.8;
    const humidity = 48 + Math.cos(angle) * 7 - livingAcOn * 3;

    const rows = [
      ["sensor.living_room_temperature", "temperature", livingTemperature, "degC"],
      ["sensor.living_room_temperature", "humidity", humidity, "%"],
      ["sensor.bedroom_temperature", "temperature", bedroomTemperature, "degC"],
      ["sensor.bedroom_temperature", "humidity", humidity + 4, "%"],
      ["climate.living_room_ac", "ac_power", livingAcOn, "bool"],
      ["climate.living_room_ac", "setpoint", livingAcOn ? 24 : 26, "degC"],
      ["climate.bedroom_ac", "ac_power", bedroomAcOn, "bool"],
      ["climate.bedroom_ac", "setpoint", bedroomAcOn ? 25 : 27, "degC"],
    ];

    for (const [externalId, metric, value, unit] of rows) {
      await pool.query(
        `
          INSERT INTO telemetry_points (
            observed_at, source, external_id, metric, value_double, value_text, unit, raw
          )
          VALUES ($1, 'home-assistant', $2, $3, $4, $5, $6, $7::jsonb)
        `,
        [
          observedAt,
          externalId,
          metric,
          Number(value.toFixed ? value.toFixed(2) : value),
          String(value),
          unit,
          JSON.stringify({ seed: true }),
        ],
      );
    }
  }

  const automations = [
    [minutesAgo(42), "客厅", "temperature", 27.9, 27.5, "客厅空调", "turn_on", "success", 18],
    [minutesAgo(315), "卧室", "temperature", 26.8, 26.5, "卧室空调", "turn_on", "success", 23],
    [minutesAgo(640), "客厅", "temperature", 28.2, 27.5, "客厅空调", "turn_on", "success", 21],
  ];

  for (const event of automations) {
    await pool.query(
      `
        INSERT INTO automation_events (
          occurred_at, room, trigger_metric, trigger_value, threshold,
          target_device, action, result, cooldown_minutes, raw
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      `,
      [...event, JSON.stringify({ seed: true })],
    );
  }

  console.log("Demo telemetry has been seeded.");
} finally {
  await pool.end();
}
