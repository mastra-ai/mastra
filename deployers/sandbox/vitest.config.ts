import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:deployers/sandbox',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts'],
  },
});
