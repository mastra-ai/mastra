import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:deployers/cloud',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
