import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

const noCoreImports = [
  'error',
  {
    patterns: [
      {
        group: ['@mastra/core', '@mastra/core/*'],
        message: 'Auth packages must not import from @mastra/core. Use @internal/auth instead.',
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
      files: ['src/**/*.{ts,tsx,js,jsx}'],
      rules: { 'no-restricted-imports': noCoreImports },
    },
  ],
});
