import { createConfig } from '@internal/lint/eslint';
import tseslint from 'typescript-eslint';

const sharedConfig = await createConfig();
const strictTypeCheckedRules = Object.assign(
  {},
  ...tseslint.configs.strictTypeChecked.map(config => config.rules ?? {}),
  ...tseslint.configs.stylisticTypeChecked.map(config => config.rules ?? {}),
);

export default [
  {
    ignores: ['dist/**', 'release/**', 'playwright-report/**', 'test-results/**'],
  },
  ...sharedConfig,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: ['./tsconfig.json', './tsconfig.renderer.json', './tsconfig.e2e.json'],
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
