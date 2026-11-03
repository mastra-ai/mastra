import { defineConfig } from 'oxlint';
import rootConfig from '../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  ignorePatterns: [
    'clickhouse/**/vitest.perf.config.ts',
    'clickhouse/docker/**/*.xml',
    'convex/**/vitest.perf.config.ts',
    'dsql/**/vitest.perf.config.ts',
    'dsql/**/performance-test.ts',
    'libsql/**/vitest.perf.config.ts',
    'pg/**/vitest.perf.config.ts',
    'pg/**/performance-test.ts',
  ],
  overrides: [
    {
      // ESLint never linted these (the root ignorePatterns reached it relative to each package), only oxlint did.
      files: ['azure-ai-search/examples/**'],
      rules: {
        'mastra/import-order': 'off',
        'no-undef': 'off',
        'typescript/no-floating-promises': 'off',
        'typescript/no-misused-promises': 'off',
      },
    },
  ],
});
