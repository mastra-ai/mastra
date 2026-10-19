import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';
import { uiSafetyOverrides } from '../../packages/_config/src/oxlint-ui.ts';

export default defineConfig({
  extends: [rootConfig],
  // This package did not previously run lint; adopt assertion checks without an unrelated lint migration.
  rules: {
    'mastra/import-order': 'off',
    'typescript/no-unnecessary-type-assertion': 'error',
    'typescript/no-unnecessary-template-expression': 'error',
    'typescript/no-unnecessary-type-arguments': 'error',
    'typescript/no-unnecessary-type-parameters': 'error',
  },
  overrides: [
    ...uiSafetyOverrides,
    {
      files: ['**/*.{ts,tsx}'],
      rules: { 'typescript/no-floating-promises': 'off', 'typescript/no-misused-promises': 'off' },
    },
  ],
});
