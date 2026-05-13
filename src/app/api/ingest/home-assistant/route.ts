import { z } from "zod";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const metricValueSchema = z.union([z.number(), z.string(), z.boolean()]);

const ingestSchema = z.object({
  source: z.string().min(1).default("home-assistant"),
  entityId: z.string().min(1),
  deviceName: z.string().min(1).optional(),
  room: z.string().min(1).optional(),
  kind: z
    .enum(["thermometer", "air_conditioner", "humidity_sensor", "switch", "unknown"])
    .default("unknown"),
  model: z.string().optional(),
  metric: z.string().min(1),
  value: metricValueSchema,
  unit: z.string().optional(),
  observedAt: z.string().datetime().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

function hasValidToken(request: Request) {
  const expected = process.env.INGEST_TOKEN;
  if (!expected) {
    return true;
  }

  const auth = request.headers.get("authorization");
  const explicit = request.headers.get("x-ingest-token");
  return auth === `Bearer ${expected}` || explicit === expected;
}

function numericValue(value: z.infer<typeof metricValueSchema>) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: Request) {
  if (!hasValidToken(request)) {
    return Response.json({ ok: false, message: "Invalid ingest token." }, { status: 401 });
  }

  const pool = getPool();
  if (!pool) {
    return Response.json(
      { ok: false, message: "DATABASE_URL is required for ingestion." },
      { status: 503 },
    );
  }

  const parsed = ingestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { ok: false, message: "Invalid payload.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const observedAt = payload.observedAt ? new Date(payload.observedAt) : new Date();
  const doubleValue = numericValue(payload.value);

  await pool.query(
    `
      INSERT INTO devices (
        source, external_id, name, room, kind, model, metadata, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
      ON CONFLICT (source, external_id)
      DO UPDATE SET
        name = COALESCE(EXCLUDED.name, devices.name),
        room = COALESCE(EXCLUDED.room, devices.room),
        kind = EXCLUDED.kind,
        model = COALESCE(EXCLUDED.model, devices.model),
        metadata = devices.metadata || EXCLUDED.metadata,
        updated_at = NOW()
    `,
    [
      payload.source,
      payload.entityId,
      payload.deviceName ?? payload.entityId,
      payload.room ?? null,
      payload.kind,
      payload.model ?? null,
      JSON.stringify(payload.attributes ?? {}),
    ],
  );

  await pool.query(
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
      observedAt,
      payload.source,
      payload.entityId,
      payload.metric,
      doubleValue,
      String(payload.value),
      payload.unit ?? null,
      JSON.stringify(payload),
    ],
  );

  return Response.json({ ok: true, observedAt: observedAt.toISOString() });
}
