import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  // This package did not previously run lint; adopt assertion checks without an unrelated lint migration.
  rules: {
    'mastra/import-order': 'off',
    'typescript/no-unnecessary-type-assertion': 'error',
    'typescript/no-unnecessary-template-expression': 'error',
    'typescript/no-unnecessary-type-arguments': 'error',
    'typescript/no-unnecessary-type-parameters': 'error',
    'mastra/sentence-case-labels': 'error',
  },
  overrides: [
    {
      files: ['**/*.{ts,tsx}'],
      rules: { 'typescript/no-floating-promises': 'off', 'typescript/no-misused-promises': 'off' },
    },
    {
      // Test stubs aren't UI people see.
      files: ['src/**/*.{test,spec}.*', 'src/**/__tests__/**'],
      rules: { 'mastra/sentence-case-labels': 'off' },
    },
  ],
});
