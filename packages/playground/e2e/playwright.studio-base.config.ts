import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './studio-base-tests',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'list' : 'html',
  use: {
    baseURL: 'http://localhost:4111/studio',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'E2E_STUDIO_BASE_PATH=/studio pnpm -C ./kitchen-sink dev',
    url: 'http://localhost:4111/studio',
    timeout: 120_000,
  },
});
