import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  overrides: [
    {
      // ESLint never linted these (its config ignored them), only oxlint did.
      files: ['.templates/**', 'scripts/**'],
      rules: {
        'mastra/import-order': 'off',
        'no-undef': 'off',
        'typescript/no-floating-promises': 'off',
        'typescript/no-misused-promises': 'off',
      },
    },
  ],
});
