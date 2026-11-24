import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { LocalTelemetry } from "../src/observability/telemetry.ts";
const path = resolve(process.env.DATA_DIRECTORY ?? ".data", "telemetry.sqlite");
if (!existsSync(path))
  throw new Error("Run the workspace once before inspecting local diagnostics.");
const journal = new LocalTelemetry(path);
try {
  console.log(JSON.stringify(journal.report(), null, 2));
} finally {
  journal.close();
}
