import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:stores/spanner',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.performance.test.ts'],
    env: {
      // Point every Spanner client at the emulator so no test falls back to
      // Application Default Credentials (absent in CI), which rejects in the
      // background and fails the run as an unhandled rejection.
      SPANNER_EMULATOR_HOST: process.env.SPANNER_EMULATOR_HOST || 'localhost:9010',
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
