import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:observability/trace-import',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
