import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:integrations/brightdata',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
