import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:deployers/cloudflare',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
