import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:browser/firecrawl',
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
