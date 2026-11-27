import { copyRuleExclusions, copyRules, pageRules } from '@mastra/playground-ui/oxlint';
import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  jsPlugins: ['@mastra/playground-ui/oxlint'],
  // This package did not previously run lint; adopt assertion checks without an unrelated lint migration.
  rules: {
    // From playground-ui's preset, only icon-button-size, placeholder-text, date-locale, and the copy rules below for now: the
    // typography rules have existing hits here.
    'playground-ui/icon-button-size': 'error',
    'playground-ui/button-icon-prop': 'error',
    'playground-ui/placeholder-text': 'error',
    'playground-ui/icon-size-from-parent': 'error',
    'playground-ui/page-layout-props': 'error',
    'playground-ui/date-locale': 'error',
    'playground-ui/no-page-spacing': 'error',
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
      rules: copyRules,
    },
    copyRuleExclusions,
    {
      files: ['src/ui/pages/**/*.tsx'],
      rules: pageRules,
    },
    {
      files: ['src/ui/pages/SignInPage.tsx'],
      rules: { 'playground-ui/no-page-width': 'off' },
    },
    {
      files: ['**/*.{ts,tsx}'],
      rules: { 'typescript/no-floating-promises': 'off', 'typescript/no-misused-promises': 'off' },
    },
    {
      // Test stubs aren't UI people see.
      files: ['src/**/*.{test,spec}.*', 'src/**/*.stories.*', 'src/**/__tests__/**'],
      rules: {
        'mastra/sentence-case-labels': 'off',
        'playground-ui/placeholder-text': 'off',
        'playground-ui/date-locale': 'off',
        'playground-ui/icon-size-from-parent': 'off',
      },
    },
  ],
});
