import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit:client-sdks/ai-sdk',
          environment: 'node',
          include: ['src/**/*.test.ts'],
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
