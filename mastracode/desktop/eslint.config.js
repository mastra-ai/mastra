import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const strictTypeCheckedRules = {
  ...tseslint.configs.strictTypeChecked.at(-1).rules,
  ...tseslint.configs.stylisticTypeChecked.at(-1).rules,
};
const typedConfigs = [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked].map(config => ({
  ...config,
  files: ['**/*.ts'],
}));

export default [
  {
    ignores: ['dist/**', 'release/**', 'playwright-report/**', 'test-results/**'],
  },
  {
    ...js.configs.recommended,
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
  ...typedConfigs,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.e2e.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...strictTypeCheckedRules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true, allowNullish: false },
      ],
    },
  },
];
