import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

// Typography must come from a DS text role (text-title, text-body, text-label…, or <Txt>).
// Tailwind's own sizes stay defined as a safety net only; the roles live in theme/typography.css.
const TYPOGRAPHY_CLASS_PATTERN = '(^|\\s|:)text-(xs|sm|base|lg|xl|\\dxl)(\\s|$)|text-\\[\\d[^\\]]*(px|rem)\\]';
const TYPOGRAPHY_MESSAGE = 'Use a DS text role (text-title / text-body / text-label / text-caption…) — see Txt.';
const restrictedTypographySelectors = [
  { selector: `Literal[value=/${TYPOGRAPHY_CLASS_PATTERN}/]`, message: TYPOGRAPHY_MESSAGE },
  { selector: `TemplateElement[value.raw=/${TYPOGRAPHY_CLASS_PATTERN}/]`, message: TYPOGRAPHY_MESSAGE },
];

// Ink on a `<Txt>` is the `tone` prop, not a class: three named tones against any
// colour Tailwind can spell, and omitting tone inherits rather than restating ink.
const TXT_TONE_MESSAGE = 'Set ink on <Txt> with tone="ink" | "muted" | "faint", not a text-* colour class.';
// Anchored at class boundaries: a variant or an alpha (`hover:text-foreground`, `text-foreground/70`)
// is something `tone` cannot express, so it stays a class.
const TXT_TONE_PATTERN = '(^|\\s)text-(foreground|muted-foreground|placeholder)(?=\\s|$)';
// `>` to the attribute: a descendant match would also flag a coloured child rendered inside a `<Txt>`.
const txtToneSelector = (node, prop) =>
  `JSXOpeningElement[name.name='Txt'] > JSXAttribute[name.name='className'] ${node}[${prop}=/${TXT_TONE_PATTERN}/]`;
const restrictedTxtToneSelectors = [
  { selector: txtToneSelector('Literal', 'value'), message: TXT_TONE_MESSAGE },
  { selector: txtToneSelector('TemplateElement', 'value.raw'), message: TXT_TONE_MESSAGE },
];

const MONO_MESSAGE =
  'Mono comes from the design system: <Txt font="mono"> for identifiers, timestamps, and durations, <InlineCode> or <CodeBlock> for code, tabular-nums for numbers.';
const MONO_PATTERN = '(^|\\s|:|!)font-mono(?=!|\\s|$)';
// Native inputs and compound controls keep their existing className escape hatch.
// Only Txt needs the font prop; do not grow every component API to satisfy lint.
const restrictedMonoSelectors = [
  {
    selector: `JSXOpeningElement[name.name='Txt'] > JSXAttribute[name.name='className'] Literal[value=/${MONO_PATTERN}/]`,
    message: MONO_MESSAGE,
  },
  {
    selector: `JSXOpeningElement[name.name='Txt'] > JSXAttribute[name.name='className'] TemplateElement[value.raw=/${MONO_PATTERN}/]`,
    message: MONO_MESSAGE,
  },
];

export default defineConfig({
  extends: [rootConfig],
  jsPlugins: ['oxlint-tailwindcss', 'eslint-plugin-storybook'],
  settings: { tailwindcss: { entryPoint: './src/index.css' } },
  ignorePatterns: ['storybook-static/**'],
  rules: {
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
    'typescript/no-non-null-assertion': 'error',
    // Tailwind (oxlint-tailwindcss; class order is oxfmt's sortTailwindcss)
    'tailwindcss/no-conflicting-classes': [
      'error',
      {
        // transition-* sets a default duration that duration-*/ease-*/delay-* are meant to override
        allow: [['(^|:)transition(-|$)', '(^|:)(duration|ease|delay)-']],
        // "x has no effect" (e.g. overflow-hidden next to truncate): real cleanups, but ESLint never reported them
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
      rules: {
        'mastra/restricted-syntax': [
          'error',
          ...restrictedTypographySelectors,
          ...restrictedTxtToneSelectors,
          ...restrictedMonoSelectors,
        ],
      },
    },
    {
      files: ['src/ds/**/*.{ts,tsx}'],
      rules: { 'mastra/restricted-syntax': ['error', ...restrictedTypographySelectors, ...restrictedTxtToneSelectors] },
    },
    {
      files: ['src/**/*.test.*', 'src/**/*.stories.*'],
      rules: { 'mastra/restricted-syntax': 'off' },
    },
    {
      files: ['**/*.stories.tsx'],
      rules: {
        'no-console': 'off',
        'no-unused-vars': 'off',
        'react/rules-of-hooks': 'off',
      },
    },
    // eslint-plugin-storybook's flat/recommended
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
      // ESLint's Tailwind plugin only ran on .js/.jsx/.ts/.tsx files.
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
