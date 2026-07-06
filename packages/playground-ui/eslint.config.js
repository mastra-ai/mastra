import { createConfig } from '@internal/lint/eslint';
import reactRefresh from 'eslint-plugin-react-refresh';
import storybook from 'eslint-plugin-storybook';

const reactHooks = (await import('eslint-plugin-react-hooks')).default;

const config = await createConfig();

const restrictedInlineIifeSelectors = [
  {
    selector: 'CallExpression[callee.type="ArrowFunctionExpression"]',
    message: 'Avoid inline IIFEs. Extract a named helper for values or a PascalCase component for JSX branches.',
  },
  {
    selector: 'CallExpression[callee.type="FunctionExpression"]',
    message: 'Avoid inline IIFEs. Extract a named helper for values or a PascalCase component for JSX branches.',
  },
];

/** @type {import("eslint").Linter.Config[]} */
export default [
  { ignores: ['storybook-static/**'] },
  ...config,
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-nested-ternary': 'error',
      'no-restricted-syntax': ['error', ...restrictedInlineIifeSelectors],
    },
  },
  {
    files: ['**/*.ts?(x)'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  ...storybook.configs['flat/recommended'],
  {
    files: ['**/*.stories.tsx'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
