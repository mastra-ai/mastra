import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit:client-sdks/ai-sdk',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.e2e.test.ts'],
        },
      },
      {
        test: {
          name: 'e2e:client-sdks/ai-sdk',
          environment: 'node',
          include: ['src/**/*.e2e.test.ts'],
        },
      },
      {
        test: {
          name: 'typecheck:client-sdks/ai-sdk',
          environment: 'node',
          include: [],
          typecheck: {
            enabled: true,
            include: ['src/**/*.test-d.ts'],
          },
        },
      },
    ],
  },
});
