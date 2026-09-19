import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:integrations/firecrawl',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
