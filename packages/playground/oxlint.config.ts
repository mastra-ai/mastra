import { recommended as playgroundUiRules } from '@mastra/playground-ui/oxlint';
import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

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
  jsPlugins: ['@mastra/playground-ui/oxlint'],
  ignorePatterns: [
    'e2e/kitchen-sink/**',
    'e2e/scripts/**',
    'e2e/playwright-report/**',
    'e2e/test-results/**',
    'e2e/playwright.config.ts',
    'e2e/tests/__utils__/**',
  ],
  rules: {
    'playground-ui/icon-button-size': 'error',
    'playground-ui/no-barrel-imports': 'error',
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
  },
  overrides: [
    {
      files: ['src/**/*.{ts,tsx}'],
      rules: playgroundUiRules,
    },
    {
      files: ['src/**/*.{test,spec}.*', 'src/**/*.stories.*', 'src/**/__tests__/**'],
      rules: { 'playground-ui/text-role': 'off', 'playground-ui/txt-tone': 'off', 'playground-ui/font-mono': 'off' },
    },
    {
      files: ['src/**/*.{test,spec}.{ts,tsx}'],
      rules: { 'mastra/restricted-syntax': ['error', ...restrictedTestMockSelectors] },
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
      },
    },
  ],
});
