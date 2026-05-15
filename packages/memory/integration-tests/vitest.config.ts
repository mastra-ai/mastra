import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const SOURCE_MODE = process.env.MASTRA_SOURCE_MODE === '1';
const SOURCE_MODE_CONDITIONS = ['mastra-source', 'import', 'node'];
const SOURCE_MODE_WORKSPACE_DEPS = [/^@mastra\//, /^@internal\//, /^mastra$/];

export default defineConfig({
  root: dirname(fileURLToPath(import.meta.url)),
  resolve: SOURCE_MODE
    ? {
        conditions: SOURCE_MODE_CONDITIONS,
      }
    : undefined,
  ssr: SOURCE_MODE
    ? {
        noExternal: SOURCE_MODE_WORKSPACE_DEPS,
        resolve: {
          conditions: SOURCE_MODE_CONDITIONS,
          externalConditions: SOURCE_MODE_CONDITIONS,
        },
      }
    : undefined,
  // Cast to any to avoid vite version mismatch type errors between workspace packages
  test: {
    execArgv: ['--no-enable-source-maps'],
    maxWorkers: 2,
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 30000,
    globalSetup: './setup.ts',
    server: SOURCE_MODE
      ? {
          deps: {
            inline: SOURCE_MODE_WORKSPACE_DEPS,
          },
        }
      : undefined,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
