import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:browser/firecrawl',
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
