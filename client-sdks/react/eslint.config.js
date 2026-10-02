import { createConfig } from '@internal/lint/eslint';

const config = await createConfig();

// Same BDD structure enforced for playground tests: outer describe = the unit,
// inner describe('when …') = one precondition, each it() = one outcome.
const BDD_MESSAGE =
  "BDD: every it()/test() must live inside a describe('when …') precondition block. " +
  "Outer describe = the unit, inner describe('when …') = ONE precondition, each it = ONE outcome.";

const testFunctionNames = new Set(['test', 'it']);
const testModifiers = new Set(['skip', 'only', 'todo', 'fails', 'each']);

function isTestCall(node) {
  if (node.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee.type === 'Identifier') return testFunctionNames.has(callee.name);
  return (
    callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier' &&
    testFunctionNames.has(callee.object.name) &&
    callee.property.type === 'Identifier' &&
    testModifiers.has(callee.property.name)
  );
}

function isDescribeCall(node) {
  if (node.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee.type === 'Identifier') return callee.name === 'describe';
  return callee.type === 'MemberExpression' && callee.object.type === 'Identifier' && callee.object.name === 'describe';
}

function describeTitle(node) {
  const arg = node.arguments[0];
  if (!arg) return null;
  if (arg.type === 'Literal' && typeof arg.value === 'string') return arg.value;
  if (arg.type === 'TemplateLiteral' && arg.quasis.length >= 1) return arg.quasis[0].value.cooked;
  return null;
}

const bddPlugin = {
  rules: {
    'test-needs-when-describe': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        return {
          CallExpression(node) {
            if (!isTestCall(node)) return;
            const ancestors = context.sourceCode.getAncestors(node);
            const nearest = ancestors.findLast(isDescribeCall);
            const title = nearest && describeTitle(nearest);
            if (!nearest || title == null || !/^when\b/.test(title)) {
              context.report({ node, message: BDD_MESSAGE });
            }
          },
        };
      },
    },
  },
};

// Tests moved from playground-ui predate this rule (it only covered Playwright
// specs there). They are frozen here; new hook tests must follow the BDD layout.
const legacyNonBddTests = [
  'src/hooks/__tests__/query-utils.test.ts',
  'src/hooks/capabilities/__tests__/use-feedback-available.msw.test.tsx',
  'src/hooks/capabilities/__tests__/use-trace-query-available.msw.test.tsx',
  'src/hooks/logs/__tests__/use-logs.msw.test.tsx',
  'src/hooks/logs/__tests__/use-logs.test.ts',
  'src/hooks/memory/__tests__/use-memory-with-om-status.msw.test.tsx',
  'src/hooks/metrics/__tests__/metrics-interval.test.ts',
  'src/hooks/metrics/__tests__/use-latency-metrics.test.tsx',
  'src/hooks/metrics/__tests__/use-token-usage-timeseries.test.tsx',
  'src/hooks/scores/__tests__/scores-refetch-interval.test.ts',
  'src/hooks/scores/__tests__/use-scores-by-scorer-id.msw.test.tsx',
  'src/hooks/scores/__tests__/use-trace-span-scores.msw.test.tsx',
  'src/hooks/traces/__tests__/use-create-feedback.msw.test.tsx',
  'src/hooks/traces/__tests__/use-discovery-cache.msw.test.tsx',
  'src/hooks/traces/__tests__/use-span-feedback.msw.test.tsx',
  'src/hooks/traces/__tests__/use-trace-spans.msw.test.tsx',
  'src/hooks/traces/__tests__/use-traces-light-list.test.tsx',
  'src/hooks/traces/__tests__/use-traces.test.ts',
  'src/hooks/workflows/__tests__/use-workflow-runs.test.ts',
  'src/hooks/workspace/__tests__/use-stored-workspaces.test.tsx',
];

/** @type {import("eslint").Linter.Config[]} */
export default [
  { ignores: ['.storybook/**'] },
  ...config,
  {
    files: ['src/hooks/**/*.{test,spec}.{ts,tsx}'],
    ignores: legacyNonBddTests,
    plugins: { bdd: bddPlugin },
    rules: { 'bdd/test-needs-when-describe': 'error' },
  },
];
