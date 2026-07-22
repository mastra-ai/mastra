import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:integrations/you-search',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
