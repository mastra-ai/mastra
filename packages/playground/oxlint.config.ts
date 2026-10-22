import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

// Typography must come from a DS text role (text-title, text-body, text-label…, or <Txt>).
// Tailwind's own sizes stay defined as a safety net only; the roles live in playground-ui/theme/typography.css.
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

const PLAYGROUND_UI_BROAD_IMPORT_MESSAGE =
  'Import from an exact @mastra/playground-ui subpath instead of a broad barrel.';

const restrictedPlaygroundUiBroadImportSources = [
  '@mastra/playground-ui',
  '@mastra/playground-ui/components',
  '@mastra/playground-ui/hooks',
  '@mastra/playground-ui/utils',
];

const restrictedPlaygroundUiBroadImportSelectors = restrictedPlaygroundUiBroadImportSources.flatMap(source => [
  {
    selector: `ImportDeclaration[source.value="${source}"]`,
    message: PLAYGROUND_UI_BROAD_IMPORT_MESSAGE,
  },
  {
    selector: `ExportNamedDeclaration[source.value="${source}"]`,
    message: PLAYGROUND_UI_BROAD_IMPORT_MESSAGE,
  },
  {
    selector: `ExportAllDeclaration[source.value="${source}"]`,
    message: PLAYGROUND_UI_BROAD_IMPORT_MESSAGE,
  },
  {
    selector: `CallExpression[callee.object.name="vi"][callee.property.name="mock"] > Literal[value="${source}"]:first-child`,
    message: PLAYGROUND_UI_BROAD_IMPORT_MESSAGE,
  },
  {
    selector: `CallExpression[callee.object.name="vi"][callee.property.name="importActual"] > Literal[value="${source}"]:first-child`,
    message: PLAYGROUND_UI_BROAD_IMPORT_MESSAGE,
  },
]);

// Enforce the playground testing contract (packages/playground/AGENTS.md + the
// `playground-msw-tests` skill): drive the real @mastra/client-js + React Query
// stack and ONLY mock the network. Mocking our own data hooks/services/auth
// gating or the SDK hides cache, transport, and gating bugs. The allowed seams
// are MSW network handlers, jsdom DOM-API polyfills in vitest.setup.ts, and the
// three thin presentational seams (react-router's Navigate, a heavy child that
// has its own dedicated test, atoms needing global context).
const PROHIBITED_MOCK_MESSAGE =
  'Do not vi.mock our own data hooks/services/auth gating or the SDK. ' +
  'Drive the real @mastra/client-js + React Query stack through MSW network ' +
  'handlers and typed fixtures instead (see packages/playground/AGENTS.md and ' +
  'the playground-msw-tests skill). Allowed seams: MSW handlers, DOM-API ' +
  "polyfills in vitest.setup.ts, react-router's Navigate, and thin stubs of a " +
  'heavy child that has its own test.';

// First-argument string literals to vi.mock() that are always prohibited.
// Covers @ aliases for our domains/hooks/services and the two SDK packages.
// Relative-path mocks of the same modules (e.g. ../../hooks/use-x) are caught
// by the second selector.
// Patterns are matched against the vi.mock() module string. Forward slashes
// must be escaped as `\/` because esquery parses the value as a regex literal,
// and we use `(\/|$)` boundaries instead of a bare `$`.
const prohibitedMockModulePatterns = [
  '^@\\/domains\\/[^\\/]+(?:\\/[^\\/]+)*\\/(hooks|services)(\\/|$)',
  '^@\\/domains\\/auth(\\/|$)',
  '^@\\/domains\\/(llm|agent-builder|agents)$',
  '^@\\/hooks(\\/|$)',
  '^@mastra\\/client-js$',
  '^@mastra\\/react$',
];

const restrictedTestMockSelectors = [
  {
    selector: prohibitedMockModulePatterns
      .map(
        pattern =>
          `CallExpression[callee.object.name="vi"][callee.property.name="mock"] > Literal[value=/${pattern}/]:first-child`,
      )
      .join(', '),
    message: PROHIBITED_MOCK_MESSAGE,
  },
  {
    // Relative-path mocks resolving to our own hooks/services/auth, use-* hooks,
    // or a domain barrel that re-exports them (agent-builder/llm/agents).
    selector:
      'CallExpression[callee.object.name="vi"][callee.property.name="mock"] > ' +
      'Literal[value=/^\\.\\.?\\/.*(\\/(hooks|services)\\/|\\/use-|\\/auth(\\/|$)|\\/(agent-builder|llm|agents)$)/]:first-child',
    message: PROHIBITED_MOCK_MESSAGE,
  },
];

// Enforce the Playwright E2E BDD shape, including modifier forms like `test.skip('...')`.
const E2E_BDD_MESSAGE =
  "E2E BDD: every test()/it() must live inside a test.describe('when …') precondition block. " +
  "Outer test.describe = the unit, inner test.describe('when …') = ONE precondition, each test = ONE outcome. " +
  'See the e2e-tests-studio skill.';

export default defineConfig({
  extends: [rootConfig],
  ignorePatterns: [
    'e2e/kitchen-sink/**',
    'e2e/scripts/**',
    'e2e/playwright-report/**',
    'e2e/test-results/**',
    'e2e/playwright.config.ts',
    'e2e/tests/__utils__/**',
  ],
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
    'mastra/sentence-case-labels': 'error',
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@mastra/playground-ui',
            message: 'Import from an exact @mastra/playground-ui subpath instead of a broad barrel.',
          },
          {
            name: '@mastra/playground-ui/components',
            message: 'Import from an exact @mastra/playground-ui subpath instead of a broad barrel.',
          },
          {
            name: '@mastra/playground-ui/hooks',
            message: 'Import from an exact @mastra/playground-ui subpath instead of a broad barrel.',
          },
          {
            name: '@mastra/playground-ui/utils',
            message: 'Import from an exact @mastra/playground-ui subpath instead of a broad barrel.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['**/*'],
      rules: { 'mastra/restricted-syntax': ['error', ...restrictedPlaygroundUiBroadImportSelectors] },
    },
    {
      files: ['src/**/*.{ts,tsx}'],
      rules: {
        'mastra/restricted-syntax': [
          'error',
          ...restrictedPlaygroundUiBroadImportSelectors,
          ...restrictedTypographySelectors,
          ...restrictedTxtToneSelectors,
          ...restrictedMonoSelectors,
        ],
      },
    },
    {
      files: ['src/**/*.{test,spec}.*', 'src/**/*.stories.*', 'src/**/__tests__/**'],
      rules: { 'mastra/restricted-syntax': ['error', ...restrictedPlaygroundUiBroadImportSelectors] },
    },
    {
      // Test stubs aren't UI people see.
      files: ['src/**/*.{test,spec}.*', 'src/**/__tests__/**'],
      rules: { 'mastra/sentence-case-labels': 'off' },
    },
    {
      files: ['src/**/*.{test,spec}.{ts,tsx}'],
      rules: {
        'mastra/restricted-syntax': [
          'error',
          ...restrictedPlaygroundUiBroadImportSelectors,
          ...restrictedTestMockSelectors,
        ],
      },
    },
    {
      // Playwright E2E specs: enforce the BDD structure described in the
      // e2e-tests-studio skill (every test()/it() nested in a describe('when …')).
      // Specs and their fixtures are outside the type-aware tsconfig program.
      files: [
        'e2e/{tests,studio-base-tests}/**/*.spec.{js,jsx,ts,tsx}',
        'e2e/{tests,studio-base-tests}/**/__tests__/fixtures/**/*.{js,jsx,ts,tsx}',
      ],
      rules: {
        'typescript/no-misused-promises': 'off',
        'typescript/no-floating-promises': 'off',
        'mastra/test-needs-when-describe': [
          'error',
          { style: 'playwright', modifiers: ['skip', 'only', 'fixme', 'fail', 'slow'], message: E2E_BDD_MESSAGE },
        ],
      },
    },
    {
      // Only oxlint's own rules ever linted this file.
      files: ['e2e/playwright.studio-base.config.ts'],
      rules: {
        'typescript/no-misused-promises': 'off',
        'typescript/no-floating-promises': 'off',
        'mastra/restricted-syntax': 'off',
      },
    },
  ],
});
