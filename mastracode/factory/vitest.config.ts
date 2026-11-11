import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit:mastra-factory',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**'],
          // Timing instrumentation patches sandbox methods in place, which
          // would replace vi.fn mocks if a developer's shell sets the flag.
          env: { FACTORY_TIMING: '' },
        },
      },
    ],
  },
});
