import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  ignorePatterns: ['**/vitest.perf.config.ts', './*.d.ts'],
});
