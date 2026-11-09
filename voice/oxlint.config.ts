import { defineConfig } from 'oxlint';
import rootConfig from '../oxlint.config.ts';

const noCoreImports = [
  'error',
  {
    patterns: [
      {
        group: ['@mastra/core', '@mastra/core/*'],
        message:
          'Voice packages must import shared voice/core primitives from @internal/voice or @internal/core, not @mastra/core.',
      },
    ],
  },
];

export default defineConfig({
  extends: [rootConfig],
  rules: {
    'no-restricted-imports': noCoreImports,
  },
  overrides: [
    {
      // Also in src test files, which the root config's test-file override exempts from top-level rules.
      files: ['*/src/**/*.{ts,tsx,js,jsx}'],
      rules: { 'no-restricted-imports': noCoreImports },
    },
  ],
});
