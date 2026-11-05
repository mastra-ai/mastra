import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

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
          exclude: ['src/**/*.e2e.test.ts'],
          setupFiles: ['@internal/test-utils/setup'],
          testTimeout: 120000,
          env: {
            OPENROUTER_API_KEY: '',
            GOOGLE_GENERATIVE_AI_API_KEY: '',
            ANTHROPIC_API_KEY: '',
            OPENAI_API_KEY: '',
          },
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
        // Runs the durable agent tests with new DurableAgent runs stored in the workflow
        // storage version agents don't use by default; agents that set `storageVersion`
        // keep it. Rewritten at load rather than mocked, so tests that reset modules to
        // stand in for a restarted process get it too.
        plugins: [
          {
            name: 'durable-agent-other-storage-version',
            enforce: 'pre',
            transform(code, id) {
              if (!id.endsWith('/src/agent/durable/durable-agent.ts')) return;
              const fallback = /(this\.#storageVersion = storageVersion \?\? )(1|2);/;
              if (!fallback.test(code)) throw new Error("DurableAgent's default storageVersion is no longer a literal");
              return code.replace(fallback, (_, head, value) => `${head}${value === '1' ? 2 : 1};`);
            },
          },
        ],
        test: {
          name: 'unit:packages/core:durable-other-storage-version',
          environment: 'node',
          include: ['src/agent/durable/**/*.test.ts'],
          exclude: ['src/**/*.e2e.test.ts'],
          setupFiles: ['@internal/test-utils/setup'],
          testTimeout: 120000,
          env: {
            OPENROUTER_API_KEY: '',
            GOOGLE_GENERATIVE_AI_API_KEY: '',
            ANTHROPIC_API_KEY: '',
            OPENAI_API_KEY: '',
          },
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
