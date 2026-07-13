import { createConfig } from '@internal/lint/eslint';

const sharedConfig = await createConfig();

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['src/mastra/public/ui/**'],
  },
  ...sharedConfig,
  {
    files: ['src/web/core-web-surface.ts', 'src/web/server-surface.ts', 'src/renderer/main.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    },
  },
];
