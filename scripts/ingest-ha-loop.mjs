import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const intervalMs = Number(process.env.HA_INGEST_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);

let running = false;

function timestamp() {
  return new Date().toISOString();
}

function runIngestion() {
  if (running) {
    console.log(`[${timestamp()}] Previous Home Assistant ingestion is still running; skipping this tick.`);
    return;
  }

  running = true;
  console.log(`[${timestamp()}] Starting Home Assistant ingestion.`);

  const child = spawn(process.execPath, ["scripts/ingest-ha.mjs"], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    running = false;
    if (code === 0) {
      console.log(`[${timestamp()}] Home Assistant ingestion completed.`);
      return;
    }

    console.error(
      `[${timestamp()}] Home Assistant ingestion failed with ${signal ? `signal ${signal}` : `code ${code}`}.`,
    );
  });
}

if (!Number.isFinite(intervalMs) || intervalMs < 30_000) {
  throw new Error("HA_INGEST_INTERVAL_MS must be at least 30000.");
}

console.log(`[${timestamp()}] Home Assistant ingestion loop interval: ${intervalMs} ms.`);
runIngestion();
setInterval(runIngestion, intervalMs);
