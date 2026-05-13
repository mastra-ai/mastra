import { defineConfig } from 'vitest/config';

const SOURCE_MODE = process.env.MASTRA_SOURCE_MODE === '1';
const SOURCE_MODE_CONDITIONS = ['mastra-source', 'node', 'import'];
const SOURCE_MODE_WORKSPACE_DEPS = [/^@mastra\//, /^@internal\//, /^mastra$/];

export default defineConfig({
  ...(SOURCE_MODE
    ? {
        resolve: { conditions: SOURCE_MODE_CONDITIONS },
        ssr: {
          noExternal: SOURCE_MODE_WORKSPACE_DEPS,
          resolve: {
            conditions: SOURCE_MODE_CONDITIONS,
            externalConditions: SOURCE_MODE_CONDITIONS,
          },
        },
      }
    : {}),
  test: {
    name: 'unit:packages/loggers',
    isolate: false,
    globals: true,
    include: ['src/**/*.test.ts'],
    ...(SOURCE_MODE
      ? {
          server: {
            deps: {
              inline: SOURCE_MODE_WORKSPACE_DEPS,
            },
          },
        }
      : {}),
  },
});
