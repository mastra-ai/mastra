import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/s3-r2.smoke.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
