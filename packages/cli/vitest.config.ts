import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/cli',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    isolate: false,
  },
});
