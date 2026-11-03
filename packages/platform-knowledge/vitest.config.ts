import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integration:packages/platform-knowledge',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
