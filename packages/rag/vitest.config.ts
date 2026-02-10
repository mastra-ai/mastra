import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:packages/rag',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
