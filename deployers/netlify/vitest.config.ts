import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:deployers/netlify',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
