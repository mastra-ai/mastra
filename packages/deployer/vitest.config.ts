import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/deployer',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
