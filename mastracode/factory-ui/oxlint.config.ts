import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  jsPlugins: ['@mastra/playground-ui/oxlint'],
  // This package did not previously run lint; adopt assertion checks without an unrelated lint migration.
  rules: {
    // Only icon-button-size from playground-ui's preset for now: the typography rules have existing hits here.
    'playground-ui/icon-button-size': 'error',
    'mastra/import-order': 'off',
    'typescript/no-unnecessary-type-assertion': 'error',
    'typescript/no-unnecessary-template-expression': 'error',
    'typescript/no-unnecessary-type-arguments': 'error',
    'typescript/no-unnecessary-type-parameters': 'error',
  },
  overrides: [
    {
      files: ['**/*.{ts,tsx}'],
      rules: { 'typescript/no-floating-promises': 'off', 'typescript/no-misused-promises': 'off' },
    },
  ],
});
