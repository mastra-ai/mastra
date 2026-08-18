import { defineConfig } from 'oxlint';
import rootConfig from '../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  ignorePatterns: ['inngest/**/vitest.perf.config.ts', 'temporal/**/vitest.perf.config.ts'],
});
