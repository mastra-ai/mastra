import { defineConfig } from 'oxlint';
import base from '../../oxlint.config.ts';

export default defineConfig({
  extends: [base],
  ignorePatterns: [...(base.ignorePatterns ?? []), 'validation/**'],
  overrides: [...(base.overrides ?? []), { files: ['scripts/**', 'examples/**'], rules: { 'no-console': 'off' } }],
});
