import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/_internals/find-workspaces',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
