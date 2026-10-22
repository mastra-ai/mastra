// Rules oxlint doesn't have natively, loaded as an oxlint JS plugin (`jsPlugins` in the root oxlint.config.ts):
//   mastra/restricted-syntax          ESLint's no-restricted-syntax: options are { selector, message } objects
//   mastra/test-needs-when-describe   every test()/it() inside a describe('when …') block (BDD test layout)
//   mastra/import-order               eslint-plugin-import-x's `order` rule, without its module resolver
//   mastra/sentence-case-labels       button, menu item and tab labels in sentence case ("Add credits", not "Add Credits")

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

// --- mastra/sentence-case-labels -----------------------------------------------------------------------
// Action labels use sentence case: only the first word and proper nouns are capitalized ("Create dataset",
// "Open in Studio"). Checks the static text of buttons, menu items and tabs, and the `aria-label`, `tooltip`
// and confirm-dialog `*Label` props of any element. Labels built at runtime (variables, ternaries) aren't seen.
// Options: { elements?: string[], properNouns?: string[] } add label elements and proper nouns to the defaults below.

// Elements whose text is a label: `button`, any component named like a button, dialog action or tab
// (`Button`, `CopyButton`, `DialogAction`, `AlertDialog.Cancel`, `MetricsCard.Tab`), and menu items.
const labelElementPattern = /(?:^button|Button|Action|Cancel|Tab|\.Item|\.CheckboxItem|\.RadioItem|\.SubTrigger)$/;
const labelProps = new Set(['aria-label', 'tooltip', 'confirmLabel', 'cancelLabel', 'submitLabel', 'actionLabel']);
const properNouns = [
  'Mastra Cloud',
  'Mastra Code',
  'Claude Code',
  'Mastra Gateway',
  'Mastra',
  'Studio',
  'Trace Intelligence',
  'Factory',
  'GitHub',
  'GitLab',
  'Google',
  'Gemini',
  'Claude',
  'Anthropic',
  'OpenAI',
  'Slack',
  'Discord',
  'Linear',
  'Vercel',
  'Cloudflare',
  'Netlify',
  'LiveKit',
  'Langfuse',
  'Datadog',
  'Sentry',
  'Stripe',
  'Chrome',
  'Markdown',
];

function jsxName(name) {
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') return `${jsxName(name.object)}.${name.property.name}`;
  return '';
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The first capitalized word after the first word of a sentence, ignoring proper nouns and acronyms.
function titleCaseWord(text, properNounPattern) {
  const words = text.replace(/&\w+;/g, ' ').replace(properNounPattern, 'x').trim().split(/\s+/);
  let sentenceStart = true;
  for (const word of words) {
    // Skip expressions and symbols ("{icon} Decline", "← Back"): they don't start the sentence.
    if (!/[A-Za-z]/.test(word)) continue;
    if (!sentenceStart && /^[A-Z][a-z]/.test(word)) return word.replace(/[^A-Za-z]+$/, '');
    sentenceStart = /[.!?:]$/.test(word);
  }
  return null;
}

// Text runs of a JSX element: a nested element starts a new run (its text is checked on its own), an
// expression is skipped ("Delete {count} items" checks "Delete items"), and each branch of a conditional
// (`{open ? 'Hide details' : <>Show details</>}`) is checked as its own run.
function textRuns(node, runs = ['']) {
  for (const child of node.children) {
    if (child.type === 'JSXText') runs[runs.length - 1] += child.value;
    else if (child.type === 'JSXExpressionContainer') {
      const text = staticString(child);
      if (text != null) runs[runs.length - 1] += text;
      else if (child.expression.type !== 'JSXEmptyExpression') {
        runs[runs.length - 1] += ' {} ';
        for (const branch of branches(child.expression)) {
          runs.push('');
          if (branch.type === 'JSXElement' || branch.type === 'JSXFragment') textRuns(branch, runs);
          else runs[runs.length - 1] += staticString(branch) ?? '';
          runs.push('');
        }
      }
    } else if (child.type === 'JSXElement' || child.type === 'JSXFragment') {
      runs.push('');
      textRuns(child, runs);
      runs.push('');
    }
  }
  return runs;
}

// The values a JSX expression can render: `a ? b : c` and `a && b` render their branches.
function branches(expression) {
  if (expression.type === 'ConditionalExpression')
    return [...branches(expression.consequent), ...branches(expression.alternate)];
  if (expression.type === 'LogicalExpression') return branches(expression.right);
  return [expression];
}

// A string literal, either bare or in a JSX expression container (`"Save"`, `{'Save'}`, `` {`Save`} ``).
function staticString(node) {
  if (node?.type === 'JSXExpressionContainer') return staticString(node.expression);
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
}

function sentenceCaseLabels(context) {
  const options = context.options[0] ?? {};
  const elements = new Set(options.elements ?? []);
  const isLabelElement = name => labelElementPattern.test(name) || elements.has(name);
  const nouns = [...properNouns, ...(options.properNouns ?? [])].sort((a, b) => b.length - a.length);
  const properNounPattern = new RegExp(`\\b(?:${nouns.map(escapeRegExp).join('|')})\\b`, 'g');
  const check = (node, text) => {
    const word = text && titleCaseWord(text, properNounPattern);
    if (!word) return;
    context.report({
      node,
      message: `Use sentence case for "${text.trim().replace(/\s+/g, ' ')}": lowercase "${word}" unless it's a proper noun (add it to properNouns).`,
    });
  };
  return {
    JSXElement(node) {
      const opening = node.openingElement;
      const name = jsxName(opening.name);
      for (const attribute of opening.attributes) {
        if (attribute.type !== 'JSXAttribute' || attribute.name.type !== 'JSXIdentifier') continue;
        const attributeName = attribute.name.name;
        if (labelProps.has(attributeName)) check(attribute, staticString(attribute.value));
      }
      if (!isLabelElement(name)) return;
      for (const run of textRuns(node)) check(node, run);
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
    'sentence-case-labels': {
      meta: { type: 'suggestion', schema: false },
      create: sentenceCaseLabels,
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
