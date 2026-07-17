import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.pooler.test.ts'],
    testTimeout: 60_000,
  },
});
