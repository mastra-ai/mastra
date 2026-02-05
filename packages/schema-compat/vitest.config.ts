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
          exclude: ['src/**/*-v3.test.ts'],
        },
        resolve: {
          alias: {
            // Alias 'zod' to 'zod-v4' so all imports resolve to the same v4 package
            zod: 'zod-v4',
          },
        },
      },
      {
        test: {
          name: 'v3',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: [
            'src/**/*-v4.test.ts',
            // Exclude provider-compats tests from v3 since they have snapshot tests
            // that produce different output between v3 (zod-to-json-schema) and v4 (native toJSONSchema)
            'src/provider-compats/*.test.ts',
          ],
        },
      },
    ],
  },
});
