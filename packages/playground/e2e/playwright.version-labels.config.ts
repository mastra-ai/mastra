import { defineConfig, devices } from '@playwright/test';

const VERSION_LABELS_BASE_URL = 'http://localhost:4112';

export default defineConfig({
  testDir: './tests',
  testMatch: 'agents/version-label-pinning.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: process.env.CI ? 'list' : 'html',

  use: {
    baseURL: VERSION_LABELS_BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // The ordinary kitchen sink uses code-source filesystem storage, which
    // intentionally rejects custom labels for code agents. Refresh the local
    // CLI dependency graph, then run an isolated DB-source dev server so this
    // journey exercises the real LibSQL label channel without slowing unrelated
    // browser specs on port 4111.
    command: `env E2E_VERSION_LABELS_LIBSQL_AGENTS=1 MASTRA_DEV=true PORT=4112 pnpm -C ./kitchen-sink start:version-labels-e2e`,
    url: VERSION_LABELS_BASE_URL,
    timeout: 120_000,
  },
});
