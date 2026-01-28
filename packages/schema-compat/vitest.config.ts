import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    projects: [
      {
        test: {
          name: 'v4',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: [
            'src/**/*-v3.test.ts',
            'src/**/*v3.test.ts',
            'src/**/zod-v3.test.ts',
          ],
        },
      },
      {
        test: {
          name: 'v3',
          environment: 'node',
          include: [
            'src/**/*-v3.test.ts',
            'src/**/*v3.test.ts',
            'src/**/zod-v3.test.ts',
          ],
        },
        resolve: {
          alias: {
            // Alias 'zod' to 'zod-v3' so all imports resolve to the same v3 package
            zod: 'zod-v3',
          },
        },
      },
    ],
  },
});
