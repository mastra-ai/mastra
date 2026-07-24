import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:deployers/cloud',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
