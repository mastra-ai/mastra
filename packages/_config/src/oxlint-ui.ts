import { defineConfig } from 'oxlint';

export const uiSafetyOverrides =
  defineConfig({
    overrides: [
      {
        files: ['**/*.{js,jsx,ts,tsx}'],
        rules: { 'no-debugger': 'error' },
      },
      {
        files: ['**/*.{ts,tsx}'],
        rules: {
          'typescript/no-require-imports': 'error',
          'typescript/ban-ts-comment': [
            'error',
            {
              'ts-expect-error': 'allow-with-description',
              'ts-ignore': true,
              'ts-nocheck': true,
              'ts-check': false,
              minimumDescriptionLength: 3,
            },
          ],
          'typescript/no-duplicate-type-constituents': 'error',
          'typescript/no-unnecessary-qualifier': 'error',
          'typescript/prefer-readonly': 'error',
        },
      },
      {
        // Preserve the existing debugger exception for tests and Playwright specs.
        files: ['**/tests/**', '**/#tests/**', '**/__tests__/**/*', '**/*.test.*', '**/*.spec.*'],
        rules: { 'no-debugger': 'off' },
      },
    ],
  }).overrides ?? [];
