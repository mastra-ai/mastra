import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.STUDIO_PORT || '4555';
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests-ui',
  globalSetup: './tests-ui/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'list' : 'html',
  timeout: 60_000,

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `MASTRA_STUDIO_PATH=.mastra/output/studio PORT=${PORT} MASTRA_HOST=0.0.0.0 node --env-file=.env .mastra/output/index.mjs`,
    url: `${BASE_URL}/api/workflows`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
