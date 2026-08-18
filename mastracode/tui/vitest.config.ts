import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit:mastracode',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**'],
          setupFiles: ['src/vitest-setup.ts'],
          maxConcurrency: 1,
          fileParallelism: false,
          isolate: true,
          env: {
            FORCE_COLOR: '1',
            TERM: 'dumb',
          },
        },
      },
    ],
  },
});
