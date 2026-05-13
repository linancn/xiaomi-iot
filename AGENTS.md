# AGENTS.md

Operational instructions for AI agents maintaining this repository.

## Mission

This project is a local Xiaomi Home / Home Assistant telemetry dashboard.

The current production goal is intentionally narrow:

- collect real Home Assistant data for exactly two devices in `Jing 大屋`
- store the data in local TimescaleDB
- show those two devices on the Next.js dashboard
- default analysis window is the latest 3 hours, with bounded backend aggregation for larger windows
- keep the service running under PM2 on port `3000`

Do not broaden the scope to whole-home discovery unless the user explicitly asks.

## Hard Scope Boundary

Only these Home Assistant devices are in scope:

- `米家智能温湿度计机房`
- `空调 巨省电Pro 1.5匹 超一级能效 2`

Only this Home Assistant area is in scope:

- displayed name: `Jing 大屋`
- user may write it as `Jing大屋`; whitespace normalization is acceptable for area matching
- known area id: `jing_da_wu`

Ignore every other room and Xiaomi device.

Entity names are not authoritative. Resolve device membership through Home Assistant registries:

- states
- entity registry
- device registry
- area registry

The registry REST paths may return `404` on this Home Assistant instance. The ingestion script must fall back to Home Assistant WebSocket registry commands.

## Safety Rules

- Never print `.env.local`, tokens, passwords, database credentials, or Home Assistant bearer tokens.
- Never hard-code the public dashboard password in source. Use `.env.local` (`DASHBOARD_PASSWORD`).
- Never commit `.env.local`, `logs/`, `.next/`, `node_modules/`, or generated screenshots.
- Never change Home Assistant or Xiaomi Home OAuth redirect settings.
- Xiaomi Home OAuth callback must stay `homeassistant.local`; do not change it to the NAS IP.
- Do not create Home Assistant automations or control devices unless the user explicitly asks.
- Do not ingest or display other rooms/devices as part of routine maintenance.
- Prefer direct DB/API verification over guessing from UI appearance.

## Current Runtime Topology

Home Assistant:

- URL: configured by `HOME_ASSISTANT_URL` in `.env.local`
- expected local address: `http://192.168.1.241:8123`
- auth: `HOME_ASSISTANT_TOKEN` in `.env.local`

Database:

- TimescaleDB via Docker Compose
- service: `db`
- container name: `xiaomi-iot-db`
- schema: `database/schema.sql`
- connection: `DATABASE_URL` in `.env.local`

Resident services:

- PM2 app `xiaomi-iot-web`: `next start -p 3000`
- PM2 app `xiaomi-iot-ingest-ha`: `scripts/ingest-ha-loop.mjs`
- ingestion interval: `HA_INGEST_INTERVAL_MS`, default configured as `300000`
- PM2 config: `ecosystem.config.cjs`
- logs: `logs/`, ignored by git

## Important Files

- `src/app/page.tsx`: server-rendered dashboard page
- `src/app/api/dashboard/route.ts`: dashboard JSON API
- `src/app/login/page.tsx`: fixed-password login page
- `src/app/api/auth/login/route.ts`: login endpoint that sets the dashboard auth cookie
- `src/app/api/auth/logout/route.ts`: logout endpoint that clears the dashboard auth cookie
- `src/app/api/health/route.ts`: health API
- `src/app/api/ingest/home-assistant/route.ts`: normalized ingestion endpoint kept for compatibility
- `src/lib/queries.ts`: DB-backed dashboard query logic and fallback selection
- `src/lib/demo-data.ts`: deterministic fallback data only
- `src/lib/db.ts`: PostgreSQL pool
- `src/lib/types.ts`: dashboard types
- `src/components/dashboard-shell.tsx`: main UI
- `src/components/climate-charts.tsx`: Recharts charts
- `scripts/ingest-ha.mjs`: one-shot Home Assistant registry/state ingestion
- `scripts/ingest-ha-loop.mjs`: PM2 resident ingestion loop
- `database/schema.sql`: TimescaleDB schema
- `compose.yaml`: TimescaleDB service
- `ecosystem.config.cjs`: PM2 process definitions

## Next.js Rule

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

For Next.js, React, Recharts, Tailwind, PM2, node-postgres, or other library-specific questions, use Context7 or local official docs before relying on memory. For local Next.js work, prefer `node_modules/next/dist/docs/`.

Known local docs that are relevant:

- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/fetch.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/runtime.md`

## Environment Contract

`.env.local` should include:

- `DATABASE_URL`
- `INGEST_TOKEN`
- `HOME_ASSISTANT_URL`
- `HOME_ASSISTANT_TOKEN`
- `DASHBOARD_PASSWORD` for public dashboard access
- `DASHBOARD_AUTH_SECRET` for signing dashboard sessions
- `DASHBOARD_COOKIE_SECURE`, set to `true` only when the public URL uses HTTPS
- optionally `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`

Read `.env.local` only through scripts or shell snippets that do not echo secrets.

If `DASHBOARD_PASSWORD` is missing, dashboard auth is disabled for local use. For public exposure, it must be set and PM2 must be reloaded.

## Data Model

Tables:

- `devices`
- `telemetry_points`
- `automation_events`

`telemetry_points` is a Timescale hypertable keyed by `observed_at`.

The scoped HA ingestion writes device metadata with:

- `metadata.ingest_scope = "jing_da_wu_two_devices"`
- `metadata.ha_device_id`
- `metadata.area_id`
- `metadata.area_name`
- `metadata.manufacturer`
- `metadata.model`
- `metadata.selected_entity_ids`

Dashboard queries should prefer rows with this scope.

## Expected Metrics

For `米家智能温湿度计机房`:

- `temperature`
- `humidity`
- `battery`
- `rssi` if Home Assistant exposes it

Current known missing metric:

- `signal/rssi` is not exposed by HA for this device

For `空调 巨省电Pro 1.5匹 超一级能效 2`:

- `ac_power`
- `hvac_mode`
- `set_temperature`
- `current_temperature`
- `fan_mode`
- `swing_mode`
- `current_humidity` if available

Temperature values are normalized to Celsius for dashboard use. Preserve original HA metadata in `telemetry_points.raw`.

Current control strategy thresholds shown in the dashboard:

- stop cooling at `25°C`
- start cooling at `28°C`

Do not hard-code a wider historical query. The dashboard API accepts `hours` and should query only the selected window with a reasonable `time_bucket` interval.

## Standard Commands

Install dependencies:

```bash
npm install
```

Start database and initialize schema:

```bash
npm run docker:up
npm run db:init
```

Run one HA ingestion:

```bash
npm run ingest:ha
```

Run local dev server:

```bash
npm run dev
```

Build production app:

```bash
npm run build
```

Start PM2 services:

```bash
npm run pm2:start
pm2 save
```

Reload PM2 after code/build changes:

```bash
npm run build
npm run pm2:reload
pm2 save
```

Inspect PM2:

```bash
npm run pm2:status
npm run pm2:logs
```

Stop only this project's PM2 services:

```bash
npm run pm2:stop
```

Do not stop unrelated PM2 processes.

## Verification Checklist

After code changes, run:

```bash
npm run lint
npm run build
```

After ingestion or service changes, verify:

```bash
curl -s http://localhost:3000/api/health
curl -s http://localhost:3000/api/dashboard
npm run pm2:status
```

`/api/dashboard` should normally show:

- `dataSource: "database"`
- `databaseStatus: "connected"`
- exactly two devices
- both devices in `Jing 大屋`

If the UI appears wrong, inspect `/api/dashboard` first. The chart may look sparse immediately after setup because only a few ingestion samples exist.

## Safe DB Inspection

Use short scripts that load `.env.local` without printing it. Example:

```bash
node --input-type=module - <<'NODE'
import fs from 'node:fs';
import pg from 'pg';

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) continue;
  let value = match[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[match[1]] ??= value;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const result = await pool.query(`
    SELECT d.name, d.room, COUNT(*)::int AS points, MAX(tp.observed_at)::text AS latest
    FROM devices d
    JOIN telemetry_points tp ON tp.source = d.source AND tp.external_id = d.external_id
    WHERE d.metadata->>'ingest_scope' = 'jing_da_wu_two_devices'
    GROUP BY d.name, d.room
    ORDER BY d.name
  `);
  console.log(JSON.stringify(result.rows, null, 2));
} finally {
  await pool.end();
}
NODE
```

## Maintenance Workflows

### If Dashboard Shows Demo Data

1. Check `curl -s http://localhost:3000/api/dashboard`.
2. If `dataSource` is `demo`, check `DATABASE_URL`, TimescaleDB, and scoped rows.
3. Run `npm run docker:up`, `npm run db:init`, then `npm run ingest:ha`.
4. Reload PM2 with `npm run pm2:reload`.

### If 3000 Is Not Serving

1. Check `ss -ltnp 'sport = :3000'`.
2. Check `npm run pm2:status`.
3. Use `npm run build && npm run pm2:reload`.
4. If PM2 has no project services, run `npm run pm2:start`.

### If Ingestion Fails

1. Check `pm2 logs xiaomi-iot-ingest-ha --nostream --lines 120`.
2. Run `npm run ingest:ha` once manually.
3. Confirm `HOME_ASSISTANT_URL` is reachable.
4. Confirm `/api/states` works with the HA token.
5. Remember registry REST may 404; WebSocket fallback is expected.

### If Adding Metrics

1. Inspect HA state attributes for the target device only.
2. Update `scripts/ingest-ha.mjs`.
3. Preserve `raw` HA metadata.
4. Update `src/lib/types.ts`, `src/lib/queries.ts`, and UI components as needed.
5. Run one ingestion and validate `/api/dashboard`.

### If Broadening Scope

Do not do this silently. First document and confirm:

- target rooms
- target device names
- metric names
- expected dashboard sections
- whether historical data migration is needed

## Git Hygiene

- Expect a dirty worktree; inspect `git status --short` before edits.
- Do not revert user changes unless explicitly asked.
- Keep changes small and verifiable.
- Remove temporary screenshots and Playwright artifacts before finishing.
- Do not commit unless the user asks.

## Known Current State

- Production web service is intended to be PM2-managed on port `3000`.
- PM2 process names are `xiaomi-iot-web` and `xiaomi-iot-ingest-ha`.
- TimescaleDB is Docker-managed, not PM2-managed.
- The ingestion loop writes a new sample immediately at startup and then every five minutes.
- The dashboard should show real HA data for only the two Jing 大屋 devices.
