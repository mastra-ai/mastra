import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:deployers/netlify',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
