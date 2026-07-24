import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:deployers/vercel',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
