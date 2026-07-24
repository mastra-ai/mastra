import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:packages/cli',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    isolate: true,
  },
});
