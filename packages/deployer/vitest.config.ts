import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/deployer',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
