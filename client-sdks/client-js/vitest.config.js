import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:client-sdks/client-js',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    typecheck: {
      enabled: true,
      include: ['src/**/*.test-d.ts'],
    },
  },
});
