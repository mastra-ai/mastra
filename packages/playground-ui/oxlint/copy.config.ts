import { fileURLToPath } from 'node:url';
import { defineConfig } from 'oxlint';
import { copyRuleExclusions, copyRules } from './index.js';

export default defineConfig({
  jsPlugins: [{ name: 'playground-ui', specifier: fileURLToPath(new URL('./index.js', import.meta.url)) }],
  categories: { correctness: 'off' },
  rules: copyRules,
  overrides: [copyRuleExclusions],
});
