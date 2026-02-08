import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:deployers/vercel',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
