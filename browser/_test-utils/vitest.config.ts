import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'e2e:browser/integration',
    globals: true,
    environment: 'node',
    testTimeout: 120_000,
  },
});
