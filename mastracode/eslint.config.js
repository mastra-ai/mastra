import { createConfig } from '@internal/lint/eslint';
import tseslint from 'typescript-eslint';

const config = await createConfig();

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    files: ['**/*.ts?(x)'],
    ...tseslint.configs.disableTypeChecked,
  },
];
