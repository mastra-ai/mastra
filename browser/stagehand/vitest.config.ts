import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit:browser/stagehand',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.e2e.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e:browser/stagehand',
          include: ['src/**/*.e2e.test.ts'],
        },
      },
    ],
  },
});
