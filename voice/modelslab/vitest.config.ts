import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:voice/modelslab',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
