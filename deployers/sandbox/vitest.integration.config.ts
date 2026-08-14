import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integration:deployers/sandbox',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
  },
});
