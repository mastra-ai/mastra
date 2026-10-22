// Rules oxlint doesn't have natively, loaded as an oxlint JS plugin (`jsPlugins` in the root oxlint.config.ts):
//   mastra/restricted-syntax          ESLint's no-restricted-syntax: options are { selector, message } objects
//   mastra/test-needs-when-describe   every test()/it() inside a describe('when …') block (BDD test layout)
//   mastra/import-order               eslint-plugin-import-x's `order` rule, without its module resolver
//   mastra/icon-button-size           a playground-ui <Button> holding only an icon uses an `icon-*` size

import { isBuiltin } from 'node:module';
import path from 'node:path';

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

// --- mastra/icon-button-size ---------------------------------------------------------------------------
// A text size (`sm`, `md`, `lg`, or none) pads the button for a label, so an icon on its own renders as a
// pill. `icon-sm|md|lg` is the same height as a square, which the design system rounds into a circle.
// Only literal sizes are checked: a forwarded `size={size}` is the wrapping component's call to make.

// An icon is a component imported from an icon module (lucide-react, an `icons/` folder), one named
// `*Icon` (`Icon`, `XIcon`, `TraceIcon`), or a spinner. Anything else may render text, like a badge.
const iconModulePattern = /^lucide-react$|\/icons?(\/|$)/;

function isIconName(name, iconImports) {
  return iconImports.has(name) || /Icon$/.test(name) || name === 'Spinner';
}

function isIconElement(node, iconImports) {
  if (node.type !== 'JSXElement') return false;
  const { name } = node.openingElement;
  return name.type === 'JSXIdentifier' && isIconName(name.name, iconImports);
}

function isIconExpression(node, iconImports) {
  if (node.type === 'JSXElement') return isIconElement(node, iconImports);
  if (node.type === 'ConditionalExpression')
    return isIconExpression(node.consequent, iconImports) && isIconExpression(node.alternate, iconImports);
  if (node.type === 'LogicalExpression' && node.operator === '&&') return isIconExpression(node.right, iconImports);
  return false;
}

function hasOnlyIconChildren(children, iconImports) {
  const content = children.filter(child => !(child.type === 'JSXText' && !child.value.trim()));
  return (
    content.length > 0 &&
    content.every(child =>
      child.type === 'JSXExpressionContainer'
        ? isIconExpression(child.expression, iconImports)
        : isIconElement(child, iconImports),
    )
  );
}

function literalAttribute(value) {
  if (value?.type === 'Literal') return value.value;
  if (value?.type === 'JSXExpressionContainer' && value.expression.type === 'Literal') return value.expression.value;
  return undefined;
}

function iconButtonSize(context) {
  const { components = ['Button'] } = context.options[0] ?? {};
  const names = new Set(components);
  const iconImports = new Set();
  return {
    ImportDeclaration(node) {
      if (!iconModulePattern.test(node.source.value)) return;
      for (const specifier of node.specifiers) iconImports.add(specifier.local.name);
    },
    JSXElement(node) {
      const { openingElement } = node;
      if (openingElement.name.type !== 'JSXIdentifier' || !names.has(openingElement.name.name)) return;
      const attributes = new Map();
      for (const attribute of openingElement.attributes) {
        // A spread may carry the size; leave those to the component that builds the props.
        if (attribute.type === 'JSXSpreadAttribute') return;
        attributes.set(attribute.name.name, attribute.value);
      }
      if (attributes.has('icon') || attributes.has('iconEnd')) return;
      if (literalAttribute(attributes.get('variant')) === 'link') return;
      if (attributes.has('size') && literalAttribute(attributes.get('size')) === undefined) return;
      const size = literalAttribute(attributes.get('size')) ?? 'md';
      if (typeof size !== 'string' || size.startsWith('icon-')) return;
      if (!hasOnlyIconChildren(node.children, iconImports)) return;
      context.report({
        node: openingElement,
        message: `This ${openingElement.name.name} holds only an icon: use size="icon-${size}" so it renders as a circle, not a pill.`,
      });
    },
  };
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

// --- mastra/import-order -------------------------------------------------------------------------------
// Ported from eslint-plugin-import-x's `order` rule (MIT), covering the options we use: `groups`,
// `pathGroups` (single `*` / `**` globs) and `alphabetize`. Imports are classified from their specifier
// alone: import-x resolved modules on disk, which only changed the result for a package importing itself by
// name while built (then "internal"), so lint no longer depends on whether `dist/` exists.
// TODO: likely temporary. Kept so moving off ESLint changes no import order. A follow-up could sort imports with
// oxfmt's `sortImports` instead (one-time reorder of ~240 files), then delete this rule.

const importTypes = ['builtin', 'external', 'internal', 'unknown', 'parent', 'sibling', 'index', 'object', 'type'];

function importType(name) {
  if (typeof name !== 'string') return 'unknown';
  if (path.isAbsolute(name)) return 'absolute';
  const [first, second] = name.split('/');
  if (isBuiltin(name.startsWith('@') ? `${first}/${second}` : first)) return 'builtin';
  if (/^\.\.$|^\.\.[/\\]/.test(name)) return 'parent';
  if (['.', './', './index', './index.js'].includes(name)) return 'index';
  if (/^\.[/\\]/.test(name)) return 'sibling';
  if (/^\w/.test(name) || /^@[^/]+\/?[^/]+/.test(name)) return 'external';
  return 'unknown';
}

function globToRegExp(glob) {
  const source = glob
    .split('/')
    .map(part =>
      part === '**'
        ? '(?:[^/]*(?:/|$))*'
        : part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '(?:/|$)',
    )
    .join('');
  return new RegExp(`^${source}$`.replace('(?:/|$)$', '$'));
}

function ranksFromOptions(options) {
  const groups = {};
  (options.groups ?? ['builtin', 'external', 'parent', 'sibling', 'index']).forEach((group, index) => {
    for (const type of [group].flat()) groups[type] = index * 2;
  });
  const fallback = (options.groups ?? [1, 2, 3, 4, 5]).length * 2;
  for (const type of importTypes) groups[type] ??= fallback;
  const pathGroups = (options.pathGroups ?? []).map(({ pattern, group }) => ({ test: globToRegExp(pattern), group }));
  return {
    groups,
    pathGroups,
    excluded: new Set(options.pathGroupsExcludedImportTypes ?? ['builtin', 'external', 'object']),
  };
}

function rankOf(entry, ranks) {
  const type = entry.type === 'import:object' ? 'object' : importType(entry.value);
  let rank;
  if (!ranks.excluded.has(type) && typeof entry.value === 'string') {
    const pathGroup = ranks.pathGroups.find(({ test }) => test.test(entry.value));
    if (pathGroup) rank = ranks.groups[pathGroup.group];
  }
  rank ??= ranks.groups[type] ?? -1;
  if (rank !== -1 && entry.type !== 'import' && !entry.type.startsWith('import:')) rank += 100;
  return rank;
}

function compareSpecifiers(a, b) {
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  if (!a.includes('/') && !b.includes('/')) return cmp(a, b);
  const A = a.split('/');
  const B = b.split('/');
  for (let i = 0; i < Math.min(A.length, B.length); i++) {
    if (i === 0 && ['.', '..'].includes(A[i]) && ['.', '..'].includes(B[i])) {
      if (A[i] !== B[i]) break;
      continue;
    }
    const result = cmp(A[i], B[i]);
    if (result) return result;
  }
  return A.length === B.length ? 0 : A.length < B.length ? -1 : 1;
}

function alphabetize(imported, { order = 'ignore', caseInsensitive = false }) {
  if (order === 'ignore') return;
  const multiplier = order === 'asc' ? 1 : -1;
  const normalize = entry => (caseInsensitive ? String(entry.value).toLowerCase() : String(entry.value));
  const byRank = Map.groupBy(imported, entry => entry.rank);
  let offset = 0;
  const newRanks = {};
  for (const rank of [...byRank.keys()].sort((a, b) => a - b)) {
    for (const entry of byRank.get(rank).sort((a, b) => multiplier * compareSpecifiers(normalize(a), normalize(b)))) {
      newRanks[`${entry.value}|${entry.node.importKind}`] = rank + offset++;
    }
  }
  for (const entry of imported) entry.rank = newRanks[`${entry.value}|${entry.node.importKind}`];
}

function findOutOfOrder(imported) {
  let max = imported[0];
  return imported.filter(entry => {
    const outOfOrder = entry.rank < max.rank;
    if (max.rank < entry.rank) max = entry;
    return outOfOrder;
  });
}

const describe = entry =>
  entry.node.importKind === 'type' ? 'type import' : entry.node.importKind === 'typeof' ? 'typeof import' : 'import';

function rootNode(node) {
  let root = node;
  while (root.parent != null && (!('body' in root.parent) || root.parent.body == null)) root = root.parent;
  return root;
}

function isRequire(expr) {
  return (
    expr?.type === 'CallExpression' &&
    expr.callee?.name === 'require' &&
    expr.arguments?.length === 1 &&
    expr.arguments[0].type === 'Literal'
  );
}

// Nodes an import can be moved across when autofixing.
function canCross(node) {
  if (node.type === 'ImportDeclaration') return node.specifiers?.length > 0;
  if (node.type === 'TSImportEqualsDeclaration') return !!node.moduleReference.expression;
  if (node.type !== 'VariableDeclaration' || node.declarations.length !== 1) return false;
  const { id, init } = node.declarations[0];
  return (
    (id?.type === 'Identifier' || id?.type === 'ObjectPattern') &&
    (isRequire(init) ||
      (init?.type === 'CallExpression' && init.callee?.type === 'MemberExpression' && isRequire(init.callee.object)))
  );
}

function lineStart(text, sourceCode, node) {
  const comments = sourceCode
    .getCommentsBefore(node)
    .filter(c => c.loc.start.line === c.loc.end.line && c.loc.end.line === node.loc.end.line);
  let start = comments.length > 0 ? comments[0].range[0] : node.range[0];
  for (let i = start - 1; i > 0 && (text[i] === ' ' || text[i] === '\t'); i--) start = i;
  return start;
}

function lineEnd(text, sourceCode, node) {
  const comments = sourceCode
    .getCommentsAfter(node)
    .filter(c => c.loc.start.line === c.loc.end.line && c.loc.end.line === node.loc.end.line);
  const end = comments.length > 0 ? comments[comments.length - 1].range[1] : node.range[1];
  let result = end;
  for (let i = end; i < text.length; i++) {
    if (text[i] === '\n') return i + 1;
    if (text[i] !== ' ' && text[i] !== '\t' && text[i] !== '\r') break;
    result = i + 1;
  }
  return result;
}

function report(context, first, second, order, fix) {
  const firstDesc = describe(first);
  const secondDesc = describe(second);
  if (first.displayName === second.displayName && firstDesc === secondDesc) return false;
  context.report({
    node: second.node,
    message: `\`${second.displayName}\` ${secondDesc} should occur ${order} ${firstDesc} of \`${first.displayName}\``,
    fix,
  });
  return true;
}

// One fix that sorts the whole block, so a single `oxlint --fix` run settles it (ESLint re-ran its
// one-import-at-a-time fixes up to 10 times; oxlint applies fixes once). Lines between imports stay put.
function sortBlockFix(context, imported) {
  const { sourceCode } = context;
  const text = sourceCode.text;
  const roots = [...new Set(imported.map(entry => rootNode(entry.node)))];
  const body = roots[0].parent?.body;
  if (!Array.isArray(body) || roots.some(root => root.parent?.body !== body)) return null;
  const indexes = roots.map(root => body.indexOf(root));
  const between = body.slice(Math.min(...indexes), Math.max(...indexes) + 1);
  if (between.some(node => !roots.includes(node) || !canCross(node))) return null;
  const segments = between.map(node => [lineStart(text, sourceCode, node), lineEnd(text, sourceCode, node)]);
  if (segments.some(([start], i) => i > 0 && start < segments[i - 1][1])) return null;
  const strip = ([start, end]) => text.slice(start, end).replace(/\r?\n$/, '');
  const sorted = [...new Set([...imported].sort((a, b) => a.rank - b.rank).map(entry => rootNode(entry.node)))];
  let output = '';
  segments.forEach(([start, end], i) => {
    if (i > 0) output += text.slice(segments[i - 1][1], start);
    output += strip(segments[between.indexOf(sorted[i])]) + text.slice(start, end).slice(strip([start, end]).length);
  });
  return fixer => fixer.replaceTextRange([segments[0][0], segments.at(-1)[1]], output);
}

function reportOutOfOrder(context, imported) {
  const outOfOrder = findOutOfOrder(imported);
  if (outOfOrder.length === 0) return;
  const reversed = imported.map(entry => ({ ...entry, rank: -entry.rank })).reverse();
  const reversedOutOfOrder = findOutOfOrder(reversed);
  const [list, entries, order] =
    reversedOutOfOrder.length < outOfOrder.length
      ? [reversed, reversedOutOfOrder, 'after']
      : [imported, outOfOrder, 'before'];
  let fix = sortBlockFix(context, imported);
  for (const entry of entries) {
    if (
      report(
        context,
        list.find(other => other.rank > entry.rank),
        entry,
        order,
        fix,
      )
    )
      fix = null;
  }
}

function importOrder(context) {
  const options = context.options[0] ?? {};
  const ranks = ranksFromOptions(options);
  const blocks = new Map();
  const register = (block, entry) => {
    const rank = rankOf(entry, ranks);
    if (rank === -1) return;
    if (!blocks.has(block)) blocks.set(block, []);
    blocks.get(block).push({ ...entry, rank });
  };
  return {
    ImportDeclaration(node) {
      if (node.specifiers.length === 0) return;
      register(node.parent, { node, value: node.source.value, displayName: node.source.value, type: 'import' });
    },
    TSImportEqualsDeclaration(node) {
      if (node.isExport) return;
      const external = node.moduleReference.type === 'TSExternalModuleReference';
      const value = external ? node.moduleReference.expression.value : '';
      register(node.parent, {
        node,
        value,
        displayName: external ? value : context.sourceCode.getText(node.moduleReference),
        type: external ? 'import' : 'import:object',
      });
    },
    CallExpression(node) {
      if (node.callee?.type !== 'Identifier' || node.callee.name !== 'require' || node.arguments.length !== 1) return;
      const [arg] = node.arguments;
      if (arg.type !== 'Literal' || typeof arg.value !== 'string') return;
      let n = node;
      while (
        (n.parent?.type === 'MemberExpression' && n.parent.object === n) ||
        (n.parent?.type === 'CallExpression' && n.parent.callee === n)
      )
        n = n.parent;
      if (
        n.parent?.type !== 'VariableDeclarator' ||
        n.parent.parent.type !== 'VariableDeclaration' ||
        n.parent.parent.parent.type !== 'Program'
      )
        return;
      register(n.parent.parent.parent, { node, value: arg.value, displayName: arg.value, type: 'require' });
    },
    'Program:exit'() {
      for (const imported of blocks.values()) {
        alphabetize(imported, options.alphabetize ?? {});
        reportOutOfOrder(context, imported);
      }
      blocks.clear();
    },
  };
}

const plugin = {
  meta: { name: 'mastra' },
  rules: {
    'import-order': {
      meta: { type: 'suggestion', fixable: 'code', schema: false },
      create: importOrder,
    },
    'restricted-syntax': {
      meta: { type: 'suggestion', schema: false },
      create: restrictedSyntax,
    },
    'icon-button-size': {
      meta: { type: 'suggestion', schema: false },
      create: iconButtonSize,
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
