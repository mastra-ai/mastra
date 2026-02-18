import { createConfig } from '@internal/lint/eslint';

const config = await createConfig();

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    files: ['**/*.ts?(x)'],
    ...(await import('typescript-eslint')).configs.disableTypeChecked,
  },
];
