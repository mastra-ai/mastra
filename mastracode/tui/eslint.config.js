import { createConfig } from '@internal/lint/eslint';
import tseslint from 'typescript-eslint';

const config = await createConfig();

const restrictedPlaygroundUiBroadImports = [
  {
    name: '@mastra/playground-ui',
    message: 'Import from an exact @mastra/playground-ui subpath instead of the root entrypoint.',
  },
  {
    name: '@mastra/playground-ui/components',
    message: 'Import from @mastra/playground-ui/components/<Component>.',
  },
  {
    name: '@mastra/playground-ui/hooks',
    message: 'Import from @mastra/playground-ui/hooks/<hook-file>.',
  },
  {
    name: '@mastra/playground-ui/utils',
    message: 'Import from @mastra/playground-ui/utils/<utility-file>.',
  },
];

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    files: ['**/*.ts?(x)'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs}'],
    rules: {
      'no-restricted-imports': ['error', { paths: restrictedPlaygroundUiBroadImports }],
    },
  },
  {
    ignores: ['scripts/**', '.tmp-mc-e2e/**', '.tmp-mc-e2e-vitest/**'],
  },
];
