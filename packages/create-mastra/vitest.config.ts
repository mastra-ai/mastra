import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/create-mastra',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    isolate: true,
  },
});
