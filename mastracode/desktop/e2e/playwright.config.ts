import { defineConfig } from '@playwright/test';

const live = process.env.MASTRACODE_DESKTOP_E2E_LIVE_CHAT === '1';

export default defineConfig({
  testDir: '.',
  testMatch: 'smoke.test.ts',
  timeout: live ? 180_000 : 120_000,
  expect: {
    timeout: 30_000,
  },
  workers: 1,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
  },
});
