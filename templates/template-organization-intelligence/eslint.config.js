import vitest from '@vitest/eslint-plugin';
import importPlugin from 'eslint-plugin-import-x';
import oxlint from 'eslint-plugin-oxlint';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import oxlintConfig from './oxlint.config.ts';

export default [
  { ignores: ['node_modules/**', '.cache/**', '.mastra/**', 'dist/**', 'build/**', 'coverage/**'] },
  {
    files: ['**/*.js', '**/*.ts'],
    languageOptions: { globals: globals.node },
    plugins: { import: importPlugin },
    rules: {
      'import/order': [
        'error',
        {
          alphabetize: { order: 'asc', caseInsensitive: true },
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        },
      ],
    },
  },
  {
    files: ['**/*.js'],
    rules: { 'no-undef': 'error', 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'all', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/tests/**', '**/*.test.*'], message: 'Do not import tests into product code.' }] },
      ],
    },
  },
  {
    files: ['**/*.test.ts'],
    plugins: { vitest },
    rules: { 'vitest/no-focused-tests': 'error', 'vitest/no-disabled-tests': 'error' },
  },
  ...oxlint.buildFromOxlintConfig(oxlintConfig),
];
