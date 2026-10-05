import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./browser",
  testMatch: "workspace.spec.ts",
  outputDir: "../.data/browser-results",
  workers: 1,
  retries: 0,
  timeout: 120000,
  expect: { timeout: 20000 },
  use: { baseURL: "http://127.0.0.1:3100", headless: true },
  webServer: {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    command: "npm exec -- next dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      COPILOTKIT_TELEMETRY_DISABLED: "true",
      AGENT_PORT: "4112",
      WEB_PORT: "3100",
    },
  },
});
