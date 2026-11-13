import { copyRuleExclusions, copyRules } from '@mastra/playground-ui/oxlint';
import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  jsPlugins: ['@mastra/playground-ui/oxlint'],
  // This package did not previously run lint; adopt assertion checks without an unrelated lint migration.
  rules: {
    // From playground-ui's preset, only icon-button-size, placeholder-text, and the copy rules below for now: the
    // typography rules have existing hits here.
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
      rules: copyRules,
    },
    copyRuleExclusions,
    {
      files: ['**/*.{ts,tsx}'],
      rules: { 'typescript/no-floating-promises': 'off', 'typescript/no-misused-promises': 'off' },
    },
    {
      // Test stubs aren't UI people see.
      files: ['src/**/*.{test,spec}.*', 'src/**/__tests__/**'],
      rules: { 'mastra/sentence-case-labels': 'off', 'playground-ui/placeholder-text': 'off' },
    },
  ],
});
