import { defineConfig } from '@playwright/test';

// Proposal screenshots only: renders the real SPA against MSW fixtures.
export default defineConfig({
  testDir: '.',
  outputDir: '../../test-results/proposal',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL: 'http://127.0.0.1:4179',
    trace: 'off',
    colorScheme: 'dark',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
  },
  reporter: [['line']],
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 4179',
    url: 'http://127.0.0.1:4179',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
