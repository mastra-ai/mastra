import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.test\.ts/,
  timeout: 120_000,
  expect: {
    timeout: 30_000,
  },
  workers: 1,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
  },
});
