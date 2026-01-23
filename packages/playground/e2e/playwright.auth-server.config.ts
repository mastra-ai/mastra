/**
 * Playwright configuration for server-side auth enforcement tests.
 *
 * This config starts the kitchen-sink app with E2E_TEST_AUTH=true,
 * enabling the TestAuthProvider for server-side permission enforcement testing.
 *
 * Run with: npx playwright test -c playwright.auth-server.config.ts
 */

import { defineConfig, devices, PlaywrightTestConfig } from '@playwright/test';

const PORT = process.env.E2E_PORT;
const BASE_URL = `http://localhost:${PORT || '4111'}`;

const webservers: PlaywrightTestConfig['webServer'] = [
  {
    // Start kitchen-sink with test auth enabled for server-side enforcement
    command: `E2E_TEST_AUTH=true pnpm -C ./kitchen-sink dev`,
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

export default defineConfig({
  // Run server-side auth enforcement tests and API bypass prevention tests
  testDir: './tests',
  testMatch: ['**/server-permission-enforcement.spec.ts', '**/api-bypass-prevention.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: process.env.CI ? 'list' : 'html',

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

  webServer: webservers,
});
