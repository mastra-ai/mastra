import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:packages/deployer',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
