import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:observability/langsmith',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
