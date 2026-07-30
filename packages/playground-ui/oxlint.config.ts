import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  ignorePatterns: ['storybook-static/**'],
  rules: {
    'react/only-export-components': [
      'warn',
      {
        allowConstantExport: true,
      },
    ],
    'react/rules-of-hooks': 'error',
    'react/exhaustive-deps': 'warn',
    'typescript/no-non-null-assertion': 'error',
  },
  overrides: [
    {
      files: ['**/*.stories.tsx'],
      rules: {
        'no-console': 'off',
        'no-unused-vars': 'off',
        'react/rules-of-hooks': 'off',
      },
    },
  ],
});
