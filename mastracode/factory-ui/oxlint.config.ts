import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  jsPlugins: ['@mastra/playground-ui/oxlint'],
  rules: {
    'playground-ui/icon-button-size': 'error',
    'playground-ui/placeholder-text': 'error',
    'mastra/import-order': 'off',
    'typescript/no-unnecessary-type-assertion': 'error',
    'typescript/no-unnecessary-template-expression': 'error',
    'typescript/no-unnecessary-type-arguments': 'error',
    'typescript/no-unnecessary-type-parameters': 'error',
    'mastra/sentence-case-labels': 'error',
  },
  overrides: [
    {
      files: ['src/**/*.{ts,tsx}'],
      rules: {
        'playground-ui/no-text-separators': 'error',
        'playground-ui/no-text-layout-spacing': 'error',
      },
    },
    {
      files: [
        'src/**/*.{test,spec,stories,story}.*',
        'src/**/{test,tests,__tests__,__mocks__,__fixtures__,fixtures,generated}/**',
      ],
      rules: {
        'playground-ui/no-text-separators': 'off',
        'playground-ui/no-text-layout-spacing': 'off',
      },
    },
    {
      files: ['**/*.{ts,tsx}'],
      rules: { 'typescript/no-floating-promises': 'off', 'typescript/no-misused-promises': 'off' },
    },
    {
      files: ['src/**/*.{test,spec}.*', 'src/**/__tests__/**'],
      rules: { 'mastra/sentence-case-labels': 'off', 'playground-ui/placeholder-text': 'off' },
    },
  ],
});
