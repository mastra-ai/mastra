import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'mc-e2e-terminal',
    environment: 'node',
    include: ['e2e/terminal-backend.vitest.test.ts'],
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    isolate: false,
    testTimeout: 90_000,
    hookTimeout: 30_000,
    env: {
      FORCE_COLOR: '1',
      TERM: 'xterm-256color',
    },
  },
});
