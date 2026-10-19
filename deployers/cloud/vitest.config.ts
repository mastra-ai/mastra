import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:deployers/cloud',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
