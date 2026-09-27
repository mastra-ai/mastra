import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '.cache/vitest',
  test: {
    allowOnly: false,
    passWithNoTests: false,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.unit.test.ts', 'tests/**/*.unit.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.integration.test.ts', 'tests/**/*.integration.test.ts', 'tests/**/integration/*.test.ts'],
          testTimeout: 15000,
          hookTimeout: 15000,
        },
      },
    ],
  },
});
