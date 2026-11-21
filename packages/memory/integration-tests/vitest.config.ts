import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Cast to any to avoid vite version mismatch type errors between workspace packages
  test: {
    execArgv: ['--no-enable-source-maps'],
    maxWorkers: Number(process.env.MEMORY_TEST_MAX_WORKERS ?? 2),
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 30000,
    globalSetup: './setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
