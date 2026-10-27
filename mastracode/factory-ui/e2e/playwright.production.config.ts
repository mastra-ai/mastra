import { defineConfig } from '@playwright/test';
import path from 'node:path';

// Chunk hashes and extracted stylesheets exist only in the production build.
export default defineConfig({
  testDir: './production',
  outputDir: '../test-results/production',
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4179',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  webServer: {
    command:
      'pnpm build --manifest && pnpm exec vite preview --config src/vite.config.ts --host 127.0.0.1 --port 4179 --strictPort',
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { MASTRACODE_OUT_DIR: path.resolve(import.meta.dirname, '../dist') },
    url: 'http://127.0.0.1:4179',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
