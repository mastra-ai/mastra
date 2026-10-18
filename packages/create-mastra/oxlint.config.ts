import { e18ePlugin, e18eRules } from '@internal/lint/e18e';
import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  ignorePatterns: ['**/starter-files/**'],
  jsPlugins: [e18ePlugin],
  rules: {
    ...e18eRules,
  },
});
