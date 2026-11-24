import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Use Node to preserve .env loading and avoid shell-specific environment assignments.
const child = spawn(
  process.execPath,
  [fileURLToPath(import.meta.resolve("next/dist/bin/next")), ...process.argv.slice(2)],
  { stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } },
);
child.once("error", () => {
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => child.kill(signal));
