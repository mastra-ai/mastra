import { createConfig } from '@internal/lint/eslint';
import reactRefresh from 'eslint-plugin-react-refresh';

const reactHooks = (await import('eslint-plugin-react-hooks')).default;

const config = await createConfig();

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

// Enforce the Playwright E2E BDD shape, including modifier forms like `test.skip('...')`.
const E2E_BDD_MESSAGE =
  "E2E BDD: every test()/it() must live inside a test.describe('when …') precondition block. " +
  "Outer test.describe = the unit, inner test.describe('when …') = ONE precondition, each test = ONE outcome. " +
  'See the e2e-tests-studio skill.';

const testFunctionNames = new Set(['test', 'it']);
const testDeclarationModifiers = new Set(['skip', 'only', 'fixme', 'fail', 'slow']);

function isStaticTestTitle(node) {
  return (
    (node.type === 'Literal' && typeof node.value === 'string') ||
    (node.type === 'TemplateLiteral' && node.quasis.length >= 1)
  );
}

function isTestDeclarationCall(node) {
  if (node.type !== 'CallExpression') return false;

  const callee = node.callee;
  if (callee.type === 'Identifier' && testFunctionNames.has(callee.name)) return true;

  if (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier' &&
    testDeclarationModifiers.has(callee.property.name) &&
    callee.object.type === 'Identifier' &&
    testFunctionNames.has(callee.object.name)
  ) {
    // Guard-style annotations like `test.skip(true, 'reason')` do not declare test cases.
    return isStaticTestTitle(node.arguments[0]);
  }

  return false;
}

/** True when a CallExpression is a `describe(...)`, `test.describe(...)`, or `it.describe(...)` call. */
function isDescribeCall(node) {
  if (node.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee.type === 'Identifier' && callee.name === 'describe') return true;
  if (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'describe' &&
    callee.object.type === 'Identifier' &&
    (callee.object.name === 'test' || callee.object.name === 'it')
  ) {
    return true;
  }
  return false;
}

/**
 * Extract the leading static text of a describe() first argument, or null.
 * For template literals with interpolation (e.g. `when the ${name} …`) we only
 * need the leading static quasi to verify the title starts with "when".
 */
function describeTitle(node) {
  const arg = node.arguments[0];
  if (!arg) return null;
  if (arg.type === 'Literal' && typeof arg.value === 'string') return arg.value;
  if (arg.type === 'TemplateLiteral' && arg.quasis.length >= 1) return arg.quasis[0].value.cooked;
  return null;
}

const e2eBddPlugin = {
  rules: {
    'test-needs-when-describe': {
      meta: {
        type: 'problem',
        docs: { description: 'Require test()/it() to be nested in a describe("when …") block.' },
        schema: [],
      },
      create(context) {
        return {
          CallExpression(node) {
            if (!isTestDeclarationCall(node)) return;
            // Walk ancestors to find the nearest enclosing describe.
            const ancestors = context.sourceCode.getAncestors(node);
            let nearestDescribe = null;
            for (let i = ancestors.length - 1; i >= 0; i--) {
              if (isDescribeCall(ancestors[i])) {
                nearestDescribe = ancestors[i];
                break;
              }
            }
            const title = nearestDescribe && describeTitle(nearestDescribe);
            if (!nearestDescribe || title == null || !/^when\b/.test(title)) {
              context.report({ node, message: E2E_BDD_MESSAGE });
            }
          },
        };
      },
    },
  },
};

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

/** @type {import("eslint").Linter.Config[]} */
export default [
  // Only Playwright spec files are linted under e2e (for BDD structure
  // enforcement below). The kitchen-sink app, test utils, config, scripts,
  // and build output under e2e remain unlinted as before.
  {
    ignores: [
      'e2e/kitchen-sink/**',
      'e2e/scripts/**',
      'e2e/playwright-report/**',
      'e2e/test-results/**',
      'e2e/playwright.config.ts',
      'e2e/playwright.studio-base.config.ts',
      'e2e/tests/__utils__/**',
    ],
  },
  ...config,
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-restricted-syntax': ['error', ...restrictedPlaygroundUiBroadImportSelectors],
    },
  },
  {
    files: ['src/**/*.{test,spec}.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...restrictedPlaygroundUiBroadImportSelectors, ...restrictedTestMockSelectors],
    },
  },
  {
    // Playwright E2E specs: enforce the BDD structure described in the
    // e2e-tests-studio skill (every test()/it() nested in a describe('when …')).
    // These files are not part of the type-aware tsconfig program, so disable
    // the TypeScript project service here and only run the syntactic BDD rule.
    files: ['e2e/{tests,studio-base-tests}/**/*.spec.{js,jsx,ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: false,
      },
    },
    plugins: {
      'e2e-bdd': e2eBddPlugin,
    },
    rules: {
      // These specs are not part of a type-aware tsconfig program, so disable
      // the @typescript-eslint rules that require type information.
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'e2e-bdd/test-needs-when-describe': 'error',
    },
  },
];
