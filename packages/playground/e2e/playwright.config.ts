import { defineConfig, devices, PlaywrightTestConfig } from '@playwright/test';

const PORT = process.env.E2E_PORT;
const BASE_URL = `http://localhost:${PORT || '4111'}`;

const webservers: PlaywrightTestConfig['webServer'] = [
  {
    command: `pnpm -C ./kitchen-sink dev`,
    url: `http://localhost:4111`,
    timeout: 120_000,
  },
];

if (PORT) {
  webservers.push({
    command: `echo "App is running on :${PORT}"`,
    url: `http://localhost:${PORT}`,
    timeout: 120_000,
    reuseExistingServer: true,
  });
}

const sequentialFolders = ['**/agents/**', '**/workflows/$workflowId/**'];

export default defineConfig({
  testDir: './tests',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'html',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: sequentialFolders,
      fullyParallel: true,
      workers: '75%',
    },
    {
      name: 'chromium-sequential',
      use: { ...devices['Desktop Chrome'] },
      testMatch: sequentialFolders,
      fullyParallel: false,
      workers: 1,
    },
  ],

  webServer: webservers,
});
