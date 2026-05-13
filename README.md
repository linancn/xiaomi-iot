# Xiaomi IoT Climate Dashboard

Local-first dashboard for Xiaomi Home climate telemetry. The first version is optimized for home analysis:

- temperature and humidity trends
- air-conditioner power and setpoint timelines
- threshold automation events
- device freshness and ingestion health

## Stack

- Next.js 16.2.6 App Router
- React 19.2.6
- Recharts 3.8.1
- node-postgres 8.20.0
- Zod 4.4.3
- TimescaleDB container `timescale/timescaledb:2.27.0-pg18`

OpenSearch is intentionally not included. This workload is time-series telemetry first, so PostgreSQL plus TimescaleDB is a smaller and faster baseline.

## Quick Start

```bash
npm run docker:up
npm run db:reset
npm run dev
```

Open <http://localhost:3000>.

If the database is not running, the dashboard falls back to deterministic demo data so the UI remains usable.

## Environment

Copy `.env.example` if you need to recreate local settings:

```bash
cp .env.example .env.local
```

`INGEST_TOKEN` protects the local ingestion endpoint when set. The checked-in example uses placeholder values only; `.env.local` is ignored by git.

## Database

Schema lives in `database/schema.sql`.

```bash
npm run db:init
npm run db:seed
```

The main tables are:

- `devices`
- `telemetry_points`
- `automation_events`

`telemetry_points` is a Timescale hypertable keyed by `observed_at`.

## Ingestion

Normalized Home Assistant events can be posted to:

```text
POST /api/ingest/home-assistant
Authorization: Bearer local-dev-token
```

Example:

```bash
curl -X POST http://localhost:3000/api/ingest/home-assistant \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer local-dev-token' \
  -d '{
    "entityId": "sensor.living_room_temperature",
    "deviceName": "客厅温湿度计",
    "room": "客厅",
    "kind": "thermometer",
    "metric": "temperature",
    "value": 27.8,
    "unit": "degC"
  }'
```

For Home Assistant, use an automation or webhook to send one normalized payload per state change. The project keeps that adapter thin so Xiaomi/Home Assistant entity naming can be adjusted locally.

## Health

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/dashboard
```
