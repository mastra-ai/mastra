import { defineConfig, devices, PlaywrightTestConfig } from '@playwright/test';

const PORT = process.env.E2E_PORT;
const BASE_URL = `http://localhost:${PORT || '4111'}`;

const webservers: PlaywrightTestConfig['webServer'] = [
  {
    // UI tests use route interception for auth mocking - no server auth needed
    // For server-side permission tests, use playwright.auth-server.config.ts
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

export default defineConfig({
  testDir: './tests',
  // Exclude server-side permission and API bypass tests - they need E2E_TEST_AUTH=true
  // Run those separately with: npx playwright test -c playwright.auth-server.config.ts
  testIgnore: ['**/server-permission-enforcement.spec.ts', '**/api-bypass-prevention.spec.ts'],
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
