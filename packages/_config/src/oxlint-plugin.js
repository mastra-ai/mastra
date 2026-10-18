// Rules oxlint doesn't have natively, loaded as an oxlint JS plugin (`jsPlugins` in the root oxlint.config.ts):
//   mastra/restricted-syntax          ESLint's no-restricted-syntax: options are { selector, message } objects
//   mastra/test-needs-when-describe   every test()/it() inside a describe('when …') block (BDD test layout)

function restrictedSyntax(context) {
  const handlers = {};
  for (const option of context.options) {
    const { selector, message } =
      typeof option === 'string' ? { selector: option, message: `Using '${option}' is not allowed.` } : option;
    const previous = handlers[selector];
    handlers[selector] = node => {
      previous?.(node);
      context.report({ node, message });
    };
  }
  return handlers;
}

const testFunctionNames = new Set(['test', 'it']);

function isStaticTitle(node) {
  return (
    (node?.type === 'Literal' && typeof node.value === 'string') ||
    (node?.type === 'TemplateLiteral' && node.quasis.length >= 1)
  );
}

// `describe(...)` plus, for Playwright, `test.describe(...)` / `it.describe(...)`;
// for Vitest, `describe.<modifier>(...)`.
function isDescribeCall(node, style) {
  if (node.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee.type === 'Identifier') return callee.name === 'describe';
  if (callee.type !== 'MemberExpression' || callee.object.type !== 'Identifier') return false;
  if (style === 'vitest') return callee.object.name === 'describe';
  return (
    callee.property.type === 'Identifier' &&
    callee.property.name === 'describe' &&
    testFunctionNames.has(callee.object.name)
  );
}

function describeTitle(node) {
  const arg = node.arguments[0];
  if (arg?.type === 'Literal' && typeof arg.value === 'string') return arg.value;
  if (arg?.type === 'TemplateLiteral' && arg.quasis.length >= 1) return arg.quasis[0].value.cooked;
  return null;
}

const plugin = {
  meta: { name: 'mastra' },
  rules: {
    'restricted-syntax': {
      meta: { type: 'suggestion', schema: false },
      create: restrictedSyntax,
    },
    'test-needs-when-describe': {
      meta: { type: 'problem', schema: false },
      create(context) {
        // style 'playwright': test.<modifier>() declares a test only with a static title, so guards like
        // `test.skip(true, 'reason')` pass; describe blocks are describe() / test.describe().
        // style 'vitest': any test.<modifier>() counts; describe blocks are describe() / describe.<modifier>().
        const {
          style = 'playwright',
          modifiers = [],
          message = "Every test()/it() must live inside a describe('when …') block.",
        } = context.options[0] ?? {};
        const testModifiers = new Set(modifiers);
        const isTestCall = node => {
          const callee = node.callee;
          if (callee.type === 'Identifier') return testFunctionNames.has(callee.name);
          return (
            callee.type === 'MemberExpression' &&
            callee.object.type === 'Identifier' &&
            testFunctionNames.has(callee.object.name) &&
            callee.property.type === 'Identifier' &&
            testModifiers.has(callee.property.name) &&
            (style === 'vitest' || isStaticTitle(node.arguments[0]))
          );
        };
        return {
          CallExpression(node) {
            if (!isTestCall(node)) return;
            const nearest = context.sourceCode.getAncestors(node).findLast(ancestor => isDescribeCall(ancestor, style));
            const title = nearest && describeTitle(nearest);
            if (!nearest || title == null || !/^when\b/.test(title)) context.report({ node, message });
          },
        };
      },
    },
  },
};

export default plugin;
