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
});
