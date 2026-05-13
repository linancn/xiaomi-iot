CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

CREATE TABLE IF NOT EXISTS devices (
  source text NOT NULL DEFAULT 'home-assistant',
  external_id text NOT NULL,
  name text,
  room text,
  kind text NOT NULL DEFAULT 'unknown',
  model text,
  is_controlled boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, external_id)
);

CREATE TABLE IF NOT EXISTS telemetry_points (
  observed_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'home-assistant',
  external_id text NOT NULL,
  metric text NOT NULL,
  value_double double precision,
  value_text text,
  unit text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (observed_at, source, external_id, metric)
);

SELECT create_hypertable(
  'telemetry_points',
  'observed_at',
  if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS telemetry_points_lookup_idx
  ON telemetry_points (source, external_id, metric, observed_at DESC);

CREATE INDEX IF NOT EXISTS telemetry_points_metric_time_idx
  ON telemetry_points (metric, observed_at DESC);

CREATE TABLE IF NOT EXISTS automation_events (
  id bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL,
  room text NOT NULL,
  trigger_metric text NOT NULL,
  trigger_value double precision NOT NULL,
  threshold double precision NOT NULL,
  target_device text NOT NULL,
  action text NOT NULL,
  result text NOT NULL DEFAULT 'pending',
  cooldown_minutes integer NOT NULL DEFAULT 0,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_events_occurred_at_idx
  ON automation_events (occurred_at DESC);

CREATE INDEX IF NOT EXISTS automation_events_room_idx
  ON automation_events (room, occurred_at DESC);
