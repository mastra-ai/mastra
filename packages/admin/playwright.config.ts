import { CurrentsConfig, currentsReporter } from '@currents/playwright';
import { PlaywrightTestConfig, defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
require('dotenv').config({ path: './.env.local' });

const currentsConfig: CurrentsConfig = {
  ciBuildId: process.env.CURRENTS_BUILD_ID ?? '',
  recordKey: process.env.CURRENTS_KEY ?? '', // 📖 https://currents.dev/readme/guides/record-key
  projectId: process.env.CURRENTS_PROJECT ?? '', // get one at https://app.currents.dev
};

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const config: PlaywrightTestConfig = {
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 5 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  timeout: 60000, // Set timeout to 60 seconds
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    video: 'on',
    screenshot: 'on',
  },

  /* Configure projects for major browsers */
  projects: [
    // Setup project
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
};

if (process.env.CURRENTS_KEY && process.env.CURRENTS_PROJECT) {
  config.reporter = [currentsReporter(currentsConfig)];
}

export default defineConfig(config);
