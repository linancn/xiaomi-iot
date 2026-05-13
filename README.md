# Xiaomi IoT Climate Dashboard

Local-first dashboard for Xiaomi Home telemetry collected through Home Assistant and stored in TimescaleDB.

This first integration is intentionally narrow. It only collects and displays two Home Assistant devices in the `Jing 大屋` area:

- `米家智能温湿度计机房`
- `空调 巨省电Pro 1.5匹 超一级能效 2`

Other rooms and Xiaomi devices are ignored.

## Stack

- Next.js 16.2.6 App Router
- React 19.2.6
- Recharts 3.8.1
- node-postgres 8.20.0
- Zod 4.4.3
- TimescaleDB container `timescale/timescaledb:2.27.0-pg18`

OpenSearch is intentionally not included. This workload is time-series telemetry first, so PostgreSQL plus TimescaleDB is a smaller and faster baseline.

## Environment

Copy `.env.example` if you need to recreate local settings:

```bash
cp .env.example .env.local
```

Set these values in `.env.local`:

```text
DATABASE_URL=postgres://xiaomi_iot:xiaomi_iot_password@localhost:5432/xiaomi_iot
INGEST_TOKEN=change-this-local-token
HOME_ASSISTANT_URL=http://192.168.1.241:8123
HOME_ASSISTANT_TOKEN=replace-with-home-assistant-long-lived-access-token
DASHBOARD_PASSWORD=replace-with-fixed-dashboard-password
DASHBOARD_AUTH_SECRET=replace-with-long-random-session-signing-secret
DASHBOARD_COOKIE_SECURE=false
```

Do not commit `.env.local`. It is ignored by git.

`DASHBOARD_PASSWORD` enables the password gate for the dashboard and `/api/dashboard`.
If it is empty or missing, the local dashboard remains open. For public exposure, set a
strong fixed password and a long random `DASHBOARD_AUTH_SECRET`, then reload PM2.

Set `DASHBOARD_COOKIE_SECURE=true` only when the public URL is served through HTTPS.

## Database

Start TimescaleDB:

```bash
npm run docker:up
```

Initialize the schema:

```bash
npm run db:init
```

The schema lives in `database/schema.sql`. Main tables:

- `devices`
- `telemetry_points`
- `automation_events`

`telemetry_points` is a Timescale hypertable keyed by `observed_at`.

## Verify Home Assistant

Verify the token can read states without printing the token:

```bash
node --input-type=module -e "
import fs from 'node:fs';
for (const line of fs.readFileSync('.env.local','utf8').split(/\\r?\\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (match) process.env[match[1]] ??= match[2].replace(/^['\\\"]|['\\\"]$/g, '');
}
const res = await fetch(new URL('/api/states', process.env.HOME_ASSISTANT_URL), {
  headers: { Authorization: 'Bearer ' + process.env.HOME_ASSISTANT_TOKEN }
});
const body = await res.json();
console.log({ status: res.status, ok: res.ok, count: Array.isArray(body) ? body.length : 0 });
"
```

Home Assistant registry data is read by `scripts/ingest-ha.mjs`. It first tries the REST registry paths and falls back to the Home Assistant WebSocket registry commands if those REST paths return 404.

## Run One Ingestion

Run:

```bash
npm run ingest:ha
```

The script:

- reads `HOME_ASSISTANT_URL`, `HOME_ASSISTANT_TOKEN`, and `DATABASE_URL` from `.env.local`
- fetches states plus entity/device/area registries
- matches `Jing 大屋` by registry area, allowing only whitespace normalization
- matches the two target device names exactly inside that area
- writes only those two devices and selected metrics to TimescaleDB
- logs any expected metrics that Home Assistant does not currently expose

Temperature values are normalized to Celsius for dashboard display. The original Home Assistant unit and metadata are preserved in each telemetry point's `raw` JSON.

## Run The Dashboard

For local development:

```bash
npm run dev
```

Open <http://localhost:3000>.

The dashboard prefers TimescaleDB data from Home Assistant. If the database is unavailable or has no rows for the two target devices, it falls back to deterministic demo data.

The default analysis window is the most recent 3 hours. Use the window controls in the dashboard, or call the API with `hours`, for example:

```bash
curl "http://localhost:3000/api/dashboard?hours=6"
```

The API only queries and aggregates the selected window instead of loading all historical telemetry. Timestamps are displayed in `Asia/Shanghai`. Current control thresholds are `25°C` stop and `28°C` start.

Useful checks:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/dashboard
```

## PM2 Services

The production process setup is in `ecosystem.config.cjs`.

It runs two PM2 apps:

- `xiaomi-iot-web`: `next start -p 3000`
- `xiaomi-iot-ingest-ha`: a resident loop that runs `scripts/ingest-ha.mjs` every five minutes

Start TimescaleDB and build the app first:

```bash
npm run docker:up
npm run db:init
npm run build
```

Start the resident Node services:

```bash
npm run pm2:start
pm2 save
```

Useful PM2 commands:

```bash
npm run pm2:status
npm run pm2:logs
npm run pm2:reload
npm run pm2:stop
```

Logs are written under `logs/`, which is ignored by git.

After changing `.env.local`, reload PM2 so the new password/session settings are used:

```bash
npm run pm2:reload
pm2 save
```

To make the saved PM2 process list restart after machine reboot, run the startup command printed by:

```bash
pm2 startup
```

## Current Limits

- Only `Jing 大屋` is in scope.
- Only `米家智能温湿度计机房` and `空调 巨省电Pro 1.5匹 超一级能效 2` are collected.
- The script does not modify Home Assistant, Xiaomi Home, OAuth redirect URLs, automations, or device settings.
- Missing metrics are reported in the ingestion log but do not fail the run.
