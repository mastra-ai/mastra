import { defineConfig } from 'oxlint';
import rootConfig from '../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  ignorePatterns: [
    'elysia/**/vitest.perf.config.ts',
    'elysia/**/performance-test.ts',
    'express/**/vitest.perf.config.ts',
    'express/**/performance-test.ts',
    'fastify/**/vitest.perf.config.ts',
    'fastify/**/performance-test.ts',
    'hono/**/vitest.perf.config.ts',
    'hono/**/performance-test.ts',
    'koa/**/vitest.perf.config.ts',
    'koa/**/performance-test.ts',
  ],
  overrides: [
    {
      // ESLint never linted these (the root ignorePatterns reached it relative to each package), only oxlint did.
      files: ['*/examples/**'],
      rules: {
        'mastra/import-order': 'off',
        'no-undef': 'off',
        'typescript/no-floating-promises': 'off',
        'typescript/no-misused-promises': 'off',
      },
    },
  ],
});
