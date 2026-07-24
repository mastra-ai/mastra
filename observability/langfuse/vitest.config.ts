import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:observability/langfuse',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
