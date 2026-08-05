import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  ignorePatterns: [
    'e2e/kitchen-sink/**',
    'e2e/scripts/**',
    'e2e/playwright-report/**',
    'e2e/test-results/**',
    'e2e/playwright.config.ts',
    'e2e/tests/__utils__/**',
  ],
  rules: {
    'react/only-export-components': [
      'warn',
      {
        allowConstantExport: true,
      },
    ],
    'react/rules-of-hooks': 'error',
    'react/exhaustive-deps': 'warn',
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@mastra/playground-ui',
            message: 'Import from an exact @mastra/playground-ui subpath instead of a broad barrel.',
          },
          {
            name: '@mastra/playground-ui/components',
            message: 'Import from an exact @mastra/playground-ui subpath instead of a broad barrel.',
          },
          {
            name: '@mastra/playground-ui/hooks',
            message: 'Import from an exact @mastra/playground-ui subpath instead of a broad barrel.',
          },
          {
            name: '@mastra/playground-ui/utils',
            message: 'Import from an exact @mastra/playground-ui subpath instead of a broad barrel.',
          },
        ],
      },
    ],
  },
});
