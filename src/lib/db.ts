import pg from "pg";

const { Pool } = pg;

declare global {
  var xiaomiIotPool: pg.Pool | undefined;
}

export function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  if (!globalThis.xiaomiIotPool) {
    globalThis.xiaomiIotPool = new Pool({
      connectionString,
      max: 8,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 2_000,
    });
  }

  return globalThis.xiaomiIotPool;
}
