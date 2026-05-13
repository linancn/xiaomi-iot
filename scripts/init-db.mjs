import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://xiaomi_iot:xiaomi_iot_password@localhost:5432/xiaomi_iot";

const schemaPath = path.join(process.cwd(), "database", "schema.sql");
const sql = await fs.readFile(schemaPath, "utf8");
const pool = new pg.Pool({ connectionString: databaseUrl });

try {
  await pool.query(sql);
  console.log("Database schema is ready.");
} finally {
  await pool.end();
}
