import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:integrations/brightdata',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
