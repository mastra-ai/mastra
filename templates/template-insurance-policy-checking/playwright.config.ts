import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.studio.test.ts',
  workers: 1,
  timeout: 120_000,
  outputDir: '.runtime/playwright-results',
  reporter: 'list',
  use: { headless: true, launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } },
});
