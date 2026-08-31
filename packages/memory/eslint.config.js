import { createConfig } from '@internal/lint/eslint';

const config = await createConfig();

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    ignores: ['src/**/explorations/**'],
  },
  {
    // Both live outside the package tsconfig's `include`, so type-aware linting has no
    // project for them. `scripts` is type-checked by tsconfig.scripts.json.
    files: ['integration-tests/**/*', 'scripts/**/*'],
    ...(await import('typescript-eslint')).configs.disableTypeChecked,
  },
];
