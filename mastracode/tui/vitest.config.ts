import { defineConfig } from 'vitest/config';

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
            // Pin the locale so dates and numbers format the same on every machine. Workers are
            // started with this env, so the locale reaches ICU before anything formats.
            LC_ALL: 'en_US.UTF-8',
          },
        },
      },
    ],
  },
});
