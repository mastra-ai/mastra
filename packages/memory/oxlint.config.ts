import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  ignorePatterns: ['src/**/explorations/**'],
  overrides: [
    {
      // Linted without type information until now (ESLint's disableTypeChecked).
      files: ['integration-tests/**/*', 'scripts/**/*'],
      rules: {
        'typescript/no-duplicate-type-constituents': 'off',
        'typescript/no-floating-promises': 'off',
        'typescript/no-misused-promises': 'off',
      },
    },
  ],
});
