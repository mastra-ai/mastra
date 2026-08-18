import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:client-sdks/client-js',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
