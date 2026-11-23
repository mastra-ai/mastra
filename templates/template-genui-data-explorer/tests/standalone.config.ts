import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./browser",
  testMatch: "standalone.spec.ts",
  outputDir: "../.data/standalone-browser-results",
  workers: 1,
  retries: 0,
  timeout: 180000,
  expect: { timeout: 30000 },
  use: { headless: true },
});
