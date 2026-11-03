import { recommended as playgroundUiRules } from '@mastra/playground-ui/oxlint';
import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  jsPlugins: ['oxlint-tailwindcss', 'eslint-plugin-storybook', '@mastra/playground-ui/oxlint'],
  settings: { tailwindcss: { entryPoint: './src/index.css' } },
  ignorePatterns: ['storybook-static/**'],
  rules: {
    'playground-ui/icon-button-size': 'error',
    'typescript/no-unnecessary-type-assertion': 'error',
    'typescript/no-unnecessary-template-expression': 'error',
    'typescript/no-unnecessary-type-arguments': 'error',
    'typescript/no-unnecessary-type-parameters': 'error',
    'react/only-export-components': [
      'warn',
      {
        allowConstantExport: true,
      },
    ],
    'react/rules-of-hooks': 'error',
    'react/exhaustive-deps': 'warn',
    'mastra/sentence-case-labels': 'error',
    'typescript/no-non-null-assertion': 'error',
    'tailwindcss/no-conflicting-classes': [
      'error',
      {
        allow: [['(^|:)transition(-|$)', '(^|:)(duration|ease|delay)-']],
        reportRedundant: false,
      },
    ],
    'tailwindcss/enforce-negative-arbitrary-values': 'warn',
    'tailwindcss/enforce-shorthand': 'warn',
    'tailwindcss/no-unnecessary-arbitrary-value': 'warn',
  },
  overrides: [
    {
      files: ['src/**/*.{ts,tsx}'],
      rules: playgroundUiRules,
    },
    {
      files: [
        'src/**/*.{test,spec,stories,story}.*',
        'src/**/{test,tests,__tests__,__mocks__,__fixtures__,fixtures,generated}/**',
      ],
      rules: {
        'playground-ui/no-text-separators': 'off',
        'playground-ui/no-text-layout-spacing': 'off',
      },
    },
    {
      files: ['src/ds/**/*.{ts,tsx}'],
      rules: { 'playground-ui/font-mono': 'off' },
    },
    {
      files: ['src/**/*.test.*', 'src/**/*.stories.*'],
      rules: { 'playground-ui/text-role': 'off', 'playground-ui/txt-tone': 'off', 'playground-ui/font-mono': 'off' },
    },
    {
      files: ['src/**/*.test.*', 'src/**/__tests__/**'],
      rules: { 'mastra/sentence-case-labels': 'off', 'playground-ui/placeholder-text': 'off' },
    },
    {
      files: ['**/*.stories.tsx'],
      rules: {
        'no-console': 'off',
        'no-unused-vars': 'off',
        'react/rules-of-hooks': 'off',
      },
    },
    {
      files: ['**/*.stories.{ts,tsx,js,jsx,mjs,cjs}', '**/*.story.{ts,tsx,js,jsx,mjs,cjs}'],
      rules: {
        'react/rules-of-hooks': 'off',
        'storybook/await-interactions': 'error',
        'storybook/context-in-play-function': 'error',
        'storybook/default-exports': 'error',
        'storybook/hierarchy-separator': 'warn',
        'storybook/no-redundant-story-name': 'warn',
        'storybook/no-renderer-packages': 'error',
        'storybook/prefer-pascal-case': 'warn',
        'storybook/story-exports': 'error',
        'storybook/use-storybook-expect': 'error',
        'storybook/use-storybook-testing-library': 'error',
      },
    },
    {
      files: ['.storybook/main.{js,cjs,mjs,ts}'],
      rules: { 'storybook/no-uninstalled-addons': 'error' },
    },
    {
      files: ['**/*.{mjs,cjs}'],
      rules: {
        'tailwindcss/no-conflicting-classes': 'off',
        'tailwindcss/enforce-negative-arbitrary-values': 'off',
        'tailwindcss/enforce-shorthand': 'off',
        'tailwindcss/no-unnecessary-arbitrary-value': 'off',
      },
    },
  ],
});
