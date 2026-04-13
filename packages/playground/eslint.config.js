import { createConfig } from '@internal/lint/eslint';
import reactRefresh from 'eslint-plugin-react-refresh';

const reactHooks = (await import('eslint-plugin-react-hooks')).default;

const config = await createConfig();

/** @type {import("eslint").Linter.Config[]} */
export default [
  { ignores: ['e2e/**'] },
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
    },
  },
];
