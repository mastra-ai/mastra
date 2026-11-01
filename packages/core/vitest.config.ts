import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { isolatedTestFiles } from './vitest.isolated-tests';

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

const unitEnv = {
  OPENROUTER_API_KEY: '',
  GOOGLE_GENERATIVE_AI_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  OPENAI_API_KEY: '',
};

export default defineConfig({
  define: {
    __MASTRA_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@internal/workflow-test-utils': path.resolve(__dirname, '../../workflows/_test-utils/src'),
    },
  },
  test: {
    projects: [
      {
        define: {
          __MASTRA_VERSION__: JSON.stringify(pkg.version),
        },
        resolve: {
          alias: {
            '@internal/workflow-test-utils': path.resolve(__dirname, '../../workflows/_test-utils/src'),
          },
        },
        test: {
          name: 'unit:packages/core',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.e2e.test.ts', ...isolatedTestFiles],
          setupFiles: ['@internal/test-utils/setup', path.resolve(__dirname, 'vitest.no-isolate-setup.ts')],
          // Files share their worker's module cache, which removes most of the import cost.
          // Files that touch process-wide state run in the isolated project below; see the header of
          // vitest.isolated-tests.ts before adding a test that mocks modules or sets env at import.
          // A failure here can come from an earlier file in the same worker: rerun the named file
          // alone, then with --sequence.shuffle.files, before blaming it.
          isolate: false,
          testTimeout: 120000,
          env: unitEnv,
        },
      },
      {
        define: {
          __MASTRA_VERSION__: JSON.stringify(pkg.version),
        },
        resolve: {
          alias: {
            '@internal/workflow-test-utils': path.resolve(__dirname, '../../workflows/_test-utils/src'),
          },
        },
        test: {
          name: 'unit:packages/core-isolated',
          environment: 'node',
          include: isolatedTestFiles,
          setupFiles: ['@internal/test-utils/setup'],
          testTimeout: 120000,
          env: unitEnv,
        },
      },
      {
        test: {
          name: 'e2e:packages/core',
          environment: 'node',
          include: ['src/**/*.e2e.test.ts'],
          setupFiles: ['@internal/test-utils/setup'],
          testTimeout: 120000,
        },
      },
      {
        test: {
          name: 'typecheck:packages/core',
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
