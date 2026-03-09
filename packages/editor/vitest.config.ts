import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/editor',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts'],
  },
});
