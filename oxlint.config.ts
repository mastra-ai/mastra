import { fileURLToPath } from 'node:url';
import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['import', 'unicorn', 'react', 'typescript', 'vitest'],
  // Absolute specifier: package configs extend this one, and oxlint rejects relative ones there.
  jsPlugins: [
    { name: 'mastra', specifier: fileURLToPath(new URL('./packages/_config/src/oxlint-plugin.js', import.meta.url)) },
  ],
  categories: {
    correctness: 'off',
  },
  env: {
    builtin: true,
    browser: true,
    node: true,
  },
  globals: {
    AudioWorkletGlobalScope: 'readonly',
    AudioWorkletProcessor: 'readonly',
    currentFrame: 'readonly',
    currentTime: 'readonly',
    registerProcessor: 'readonly',
    sampleRate: 'readonly',
    WorkletGlobalScope: 'readonly',
  },
  ignorePatterns: [
    '**/.tsup/**',
    '**/.mastra/**',
    '**/.cache/**',
    '**/node_modules/**',
    '**/playwright-report/**',
    '**/dist/**',
    '**/coverage/**',
    '**/tsup.config.bundled_*',
    'examples/**',
    'docs/**',
    'explorations/**',
    'e2e-tests/**',
    'templates/**',
    'ee/**',
  ],
  rules: {
    'no-dupe-keys': 'error',
    'no-useless-return': 'error',
    'no-extra-boolean-cast': 'error',
    'no-useless-catch': 'error',
    'no-unneeded-ternary': 'error',
    'no-useless-concat': 'error',
    'no-restricted-globals': ['error', 'global'],
    'no-unexpected-multiline': 'error',
    'no-warning-comments': [
      'error',
      {
        terms: ['FIXME'],
        location: 'anywhere',
      },
    ],
    'import/no-duplicates': [
      'error',
      {
        'prefer-inline': false,
      },
    ],
    'unicorn/prefer-node-protocol': 'error',
    'react/jsx-key': 'warn',
    'mastra/import-order': [
      'error',
      {
        alphabetize: { order: 'asc', caseInsensitive: true },
        pathGroups: [{ pattern: '#*/**', group: 'internal' }],
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      },
    ],
  },
  overrides: [
    {
      // TODO: meant to be on; off since #20173 broke this override's glob (`?(x)` matched no file).
      // ~1,155 violations to clean up in follow-up PRs, one rule family each.
      files: ['**/*.{ts,tsx}', '**/*.{js,jsx}'],
      rules: {
        'no-console': [
          'off',
          {
            allow: ['warn', 'error', 'info', 'table', 'time', 'timeEnd', 'dir'],
          },
        ],
        'no-debugger': 'off',
      },
    },
    {
      files: ['**/*.{js,jsx}'],
      // Repeated here: a package config that extends this one doesn't inherit the top-level env.
      env: { builtin: true, browser: true, node: true },
      rules: {
        'no-undef': 'error',
        // TODO: meant to be on; off since #20173 broke this override's glob (`?(x)` matched no file).
        // ~1,155 violations to clean up in follow-up PRs, one rule family each.
        'no-unused-vars': [
          'off',
          {
            args: 'after-used',
            argsIgnorePattern: '^_',
            caughtErrors: 'all',
            destructuredArrayIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            ignoreRestSiblings: true,
          },
        ],
      },
    },
    {
      // TODO: the rules still 'off' here are meant to be on; off since #20173 broke this override's glob
      // (`?(x)` matched no file). ~500 violations left to clean up in follow-up PRs, one rule family each.
      files: ['**/*.{ts,tsx}'],
      rules: {
        'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
        'eslint/no-unused-vars': [
          'off',
          {
            args: 'after-used',
            argsIgnorePattern: '^_',
            caughtErrors: 'all',
            destructuredArrayIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            ignoreRestSiblings: true,
          },
        ],
        'typescript/consistent-type-imports': [
          'error',
          {
            prefer: 'type-imports',
            // `typeof import('x')` is already type-only; tests use it with vi.importActual.
            disallowTypeAnnotations: false,
            fixStyle: 'separate-type-imports',
          },
        ],
        'typescript/no-require-imports': 'off',
        'typescript/prefer-as-const': 'error',
        'typescript/ban-ts-comment': [
          'off',
          {
            'ts-expect-error': 'allow-with-description',
            'ts-ignore': true,
            'ts-nocheck': true,
            'ts-check': false,
            minimumDescriptionLength: 3,
          },
        ],
      },
      plugins: ['typescript'],
    },
    // TODO: the ban on importing test files from source (`no-restricted-imports` with test-file patterns) is meant
    // to be on; off since #20173 broke its override's glob. Don't re-add it here as a root override: oxlint applies an
    // extended config's overrides after a package's own rules, so it would replace the packages' import bans.

    // Type-aware (oxlint --type-aware, oxlint-tsgolint): enforced by ESLint's typescript-eslint until now.
    {
      files: ['**/*.{ts,tsx}'],
      rules: {
        'typescript/no-meaningless-void-operator': 'error',
        'typescript/prefer-reduce-type-parameter': 'error',
        'typescript/no-floating-promises': 'error',
        'typescript/no-misused-promises': ['error', { checksVoidReturn: false }],
      },
    },
    {
      files: [
        '**/tests/**',
        '**/#tests/**',
        '**/__tests__/**/*',
        '**/*.test.*',
        '**/*.spec.*',
        'vitest.config.ts',
        '**/oxlint.config.ts',
      ],
      rules: {
        'typescript/await-thenable': 'off',
        'typescript/consistent-return': 'off',
        'typescript/consistent-type-exports': 'off',
        'typescript/dot-notation': 'off',
        'typescript/no-array-delete': 'off',
        'typescript/no-base-to-string': 'off',
        'typescript/no-confusing-void-expression': 'off',
        'typescript/no-deprecated': 'off',
        'typescript/no-duplicate-type-constituents': 'off',
        'typescript/no-floating-promises': 'off',
        'typescript/no-for-in-array': 'off',
        'typescript/no-implied-eval': 'off',
        'typescript/no-misused-promises': 'off',
        'typescript/no-misused-spread': 'off',
        'typescript/no-mixed-enums': 'off',
        'typescript/no-redundant-type-constituents': 'off',
        'typescript/no-unnecessary-boolean-literal-compare': 'off',
        'typescript/no-unnecessary-condition': 'off',
        'typescript/no-unnecessary-qualifier': 'off',
        'typescript/no-unnecessary-type-conversion': 'off',
        'typescript/no-unsafe-argument': 'off',
        'typescript/no-unsafe-assignment': 'off',
        'typescript/no-unsafe-call': 'off',
        'typescript/no-unsafe-enum-comparison': 'off',
        'typescript/no-unsafe-member-access': 'off',
        'typescript/no-unsafe-return': 'off',
        'typescript/no-unsafe-type-assertion': 'off',
        'typescript/no-unsafe-unary-minus': 'off',
        'typescript/no-useless-default-assignment': 'off',
        'typescript/non-nullable-type-assertion-style': 'off',
        'typescript/only-throw-error': 'off',
        'typescript/prefer-find': 'off',
        'typescript/prefer-includes': 'off',
        'typescript/prefer-nullish-coalescing': 'off',
        'typescript/prefer-optional-chain': 'off',
        'typescript/prefer-promise-reject-errors': 'off',
        'typescript/prefer-readonly': 'off',
        'typescript/prefer-readonly-parameter-types': 'off',
        'typescript/prefer-regexp-exec': 'off',
        'typescript/prefer-return-this-type': 'off',
        'typescript/prefer-string-starts-ends-with': 'off',
        'typescript/promise-function-async': 'off',
        'typescript/related-getter-setter-pairs': 'off',
        'typescript/require-array-sort-compare': 'off',
        'typescript/require-await': 'off',
        'typescript/restrict-plus-operands': 'off',
        'typescript/restrict-template-expressions': 'off',
        'typescript/return-await': 'off',
        'typescript/strict-boolean-expressions': 'off',
        'typescript/strict-void-return': 'off',
        'typescript/switch-exhaustiveness-check': 'off',
        'typescript/unbound-method': 'off',
        'typescript/use-unknown-in-catch-callback-variable': 'off',
      },
      plugins: ['typescript'],
    },
    {
      files: ['**/tests/**', '**/#tests/**', '**/__tests__/**/*', '**/*.test.*', '**/*.spec.*'],
      rules: {
        'no-console': 'off',
        'no-debugger': 'off',
        'no-restricted-globals': 'off',
        'no-restricted-imports': 'off',
        'vitest/no-focused-tests': 'error',
      },
      plugins: ['vitest'],
    },
    {
      // ESLint kept type-aware rules on test files inside e2e folders (they're excluded from its test-file override).
      files: ['**/e2e/**/*.{ts,tsx}'],
      rules: {
        'typescript/no-floating-promises': 'error',
        'typescript/no-misused-promises': ['error', { checksVoidReturn: false }],
      },
    },
  ],
});
