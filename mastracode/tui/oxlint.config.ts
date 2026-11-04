import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  ignorePatterns: ['scripts/**', '.tmp-mc-e2e/**', '.tmp-mc-e2e-vitest/**'],
  overrides: [
    {
      // Linted without type information until now (ESLint's disableTypeChecked).
      files: ['**/*.{ts,tsx}'],
      rules: { 'typescript/no-floating-promises': 'off', 'typescript/no-misused-promises': 'off' },
    },
    {
      // An override, not a top-level rule: the root config's test-file override would otherwise turn it off in tests.
      files: ['**/*.{ts,tsx,js,jsx,mjs}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '@mastra/playground-ui',
                message: 'Import from an exact @mastra/playground-ui subpath instead of the root entrypoint.',
              },
              {
                name: '@mastra/playground-ui/components',
                message: 'Import from @mastra/playground-ui/components/<Component>.',
              },
              {
                name: '@mastra/playground-ui/hooks',
                message: 'Import from @mastra/playground-ui/hooks/<hook-file>.',
              },
              {
                name: '@mastra/playground-ui/utils',
                message: 'Import from @mastra/playground-ui/utils/<utility-file>.',
              },
            ],
          },
        ],
      },
    },
  ],
});
