import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:deployers/cloudflare',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
