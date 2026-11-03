import { recommended as playgroundUiRules } from '@mastra/playground-ui/oxlint';
import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

const PROHIBITED_MOCK_MESSAGE =
  'Do not vi.mock our own data hooks/services/auth gating or the SDK. ' +
  'Drive the real @mastra/client-js + React Query stack through MSW network ' +
  'handlers and typed fixtures instead (see packages/playground/AGENTS.md and ' +
  'the playground-msw-tests skill). Allowed seams: MSW handlers, DOM-API ' +
  "polyfills in vitest.setup.ts, react-router's Navigate, and thin stubs of a " +
  'heavy child that has its own test.';

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
    selector:
      'CallExpression[callee.object.name="vi"][callee.property.name="mock"] > ' +
      'Literal[value=/^\\.\\.?\\/.*(\\/(hooks|services)\\/|\\/use-|\\/auth(\\/|$)|\\/(agent-builder|llm|agents)$)/]:first-child',
    message: PROHIBITED_MOCK_MESSAGE,
  },
];

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
    'mastra/sentence-case-labels': 'error',
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
      files: ['src/**/*.{test,spec}.*', 'src/**/*.stories.*', 'src/**/__tests__/**'],
      rules: { 'playground-ui/text-role': 'off', 'playground-ui/txt-tone': 'off', 'playground-ui/font-mono': 'off' },
    },
    {
      files: ['src/**/*.{test,spec}.*', 'src/**/__tests__/**'],
      rules: { 'mastra/sentence-case-labels': 'off', 'playground-ui/placeholder-text': 'off' },
    },
    {
      files: ['src/**/*.{test,spec}.{ts,tsx}'],
      rules: { 'mastra/restricted-syntax': ['error', ...restrictedTestMockSelectors] },
    },
    {
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
      files: ['e2e/playwright.studio-base.config.ts'],
      rules: {
        'typescript/no-misused-promises': 'off',
        'typescript/no-floating-promises': 'off',
      },
    },
  ],
});
