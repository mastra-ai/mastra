import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['import', 'unicorn', 'typescript', 'vitest'],
  categories: { correctness: 'off' },
  env: { builtin: true, node: true },
  ignorePatterns: ['node_modules/**', '.cache/**', '.mastra/**', 'dist/**', 'coverage/**'],
  rules: {
    'no-restricted-globals': ['error', 'global'],
    'no-unexpected-multiline': 'error',
    'no-warning-comments': ['error', { terms: ['FIXME'], location: 'anywhere' }],
    'no-console': ['error', { allow: ['warn', 'error', 'info', 'table', 'time', 'timeEnd', 'dir'] }],
    'no-debugger': 'error',
    'import/no-duplicates': ['error', { preferInline: false }],
    'unicorn/prefer-node-protocol': 'error',
  },
  overrides: [
    {
      files: ['**/*.ts'],
      rules: {
        'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
        'typescript/consistent-type-imports': [
          'error',
          { prefer: 'type-imports', disallowTypeAnnotations: true, fixStyle: 'separate-type-imports' },
        ],
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
      },
    },
    {
      files: ['**/*.test.ts'],
      rules: { 'vitest/no-focused-tests': 'error', 'vitest/no-disabled-tests': 'error' },
    },
  ],
});
