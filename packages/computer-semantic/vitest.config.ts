import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/computer-semantic',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
