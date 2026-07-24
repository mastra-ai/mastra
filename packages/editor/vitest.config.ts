import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:packages/editor',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts'],
  },
});
