import { createConfig } from '@internal/lint/eslint';

const config = await createConfig();

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    ignores: ['src/playground/**'],
  },
];
