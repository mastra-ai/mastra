import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['import', 'unicorn', 'typescript', 'vitest'],
  categories: { correctness: 'error' },
  env: { builtin: true, node: true },
  ignorePatterns: ['node_modules/**', '.mastra/**', 'data/**', 'coverage/**'],
  rules: {
    'no-restricted-globals': ['error', 'global'],
    'no-unexpected-multiline': 'error',
    'no-warning-comments': ['error', { terms: ['FIXME'], location: 'anywhere' }],
    'import/no-duplicates': 'error',
    'unicorn/prefer-node-protocol': 'error',
    'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    'no-debugger': 'error',
    'typescript/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'separate-type-imports' }],
    'typescript/no-require-imports': 'error',
    'typescript/ban-ts-comment': ['error', { 'ts-ignore': true, 'ts-nocheck': true }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-restricted-imports': ['error', { patterns: ['**/tests/**', '**/*.test.*'] }],
  },
  overrides: [
    {
      files: ['tests/**', 'scripts/attio-demo.ts', 'vitest.config.ts'],
      rules: { 'no-restricted-imports': 'off', 'vitest/no-focused-tests': 'error' },
    },
  ],
});
