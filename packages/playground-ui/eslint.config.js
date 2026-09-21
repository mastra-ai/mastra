import { createConfig } from '@internal/lint/eslint';
import reactRefresh from 'eslint-plugin-react-refresh';
import storybook from 'eslint-plugin-storybook';
import tailwindcss from 'eslint-plugin-tailwindcss';

const reactHooks = (await import('eslint-plugin-react-hooks')).default;

const config = await createConfig();

// Typography must come from a DS text role (text-title, text-body, text-label…, or <Txt>).
// Tailwind's own sizes stay defined as a safety net only; the roles live in theme/typography.css.
const TYPOGRAPHY_CLASS_PATTERN = '(^|\\s|:)text-(xs|sm|base|lg|xl|\\dxl)(\\s|$)|text-\\[\\d[^\\]]*(px|rem)\\]';
const TYPOGRAPHY_MESSAGE = 'Use a DS text role (text-title / text-body / text-label / text-caption…) — see Txt.';
const restrictedTypographySelectors = [
  { selector: `Literal[value=/${TYPOGRAPHY_CLASS_PATTERN}/]`, message: TYPOGRAPHY_MESSAGE },
  { selector: `TemplateElement[value.raw=/${TYPOGRAPHY_CLASS_PATTERN}/]`, message: TYPOGRAPHY_MESSAGE },
];

/** @type {import("eslint").Linter.Config[]} */
export default [
  { ignores: ['storybook-static/**'] },
  ...config,
  {
    ...tailwindcss.configs.recommended,
    rules: {
      ...tailwindcss.configs.recommended.rules,
      // The rule currently flags valid v4 infinite-spacing utilities, imported
      // theme tokens, and intentional CSS hooks as custom class names.
      'tailwindcss/no-custom-classname': 'off',
    },
    settings: {
      tailwindcss: {
        cssConfigPath: './src/index.css',
      },
    },
  },
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
  {
    files: ['**/*.ts?(x)'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    files: ['src/**/*.ts?(x)'],
    ignores: ['src/**/*.test.*', 'src/**/*.stories.*', 'src/ee/**'],
    rules: {
      'no-restricted-syntax': ['error', ...restrictedTypographySelectors],
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
