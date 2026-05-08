import { defineConfig, devices, PlaywrightTestConfig } from '@playwright/test';

const PORT = process.env.E2E_PORT;
const BASE_URL = `http://localhost:${PORT || '4111'}`;

const webservers: PlaywrightTestConfig['webServer'] = [
  {
    // UI tests use route interception for auth mocking - no server auth needed
    // Server-side permission tests are in server-adapters/hono
    // mastra dev serves Studio from packages/cli/dist/studio (copied from @internal/playground at CLI build time).
    command: `bash -lc 'cd ../../.. && pnpm build:cli && pnpm --dir packages/playground/e2e/kitchen-sink dev'`,
    url: `http://localhost:4111`,
    timeout: 600_000,
    /** Avoid failing when another mastra dev instance already owns :4111 (local/dev agents). */
    reuseExistingServer: !process.env.CI,
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
