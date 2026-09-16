import { defineConfig, devices } from "@playwright/test";

const requestedPort = process.env.E2E_PORT ?? "5173";
const e2ePort = Number(requestedPort);
if (!Number.isInteger(e2ePort) || e2ePort < 1 || e2ePort > 65_535)
  throw new Error("E2E_PORT must be an integer from 1 through 65535.");
const e2eUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./test/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: e2eUrl,
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `npm run --workspace support-demo-ui dev -- --host 127.0.0.1 --port ${e2ePort} --strictPort`,
    url: e2eUrl,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
