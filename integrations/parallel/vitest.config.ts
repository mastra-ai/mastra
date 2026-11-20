import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:integrations/parallel',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
