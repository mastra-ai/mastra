import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:integrations/mrscraper',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
