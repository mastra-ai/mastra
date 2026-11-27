import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:packages/_internals/find-workspaces',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
