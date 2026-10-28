// Design-system lint rules for apps built on @mastra/playground-ui, as an oxlint JS plugin.
//
//   // oxlint.config.ts
//   import { recommended } from '@mastra/playground-ui/oxlint';
//   export default defineConfig({
//     jsPlugins: ['@mastra/playground-ui/oxlint'],
//     rules: { ...recommended },
//   });
//
// Rules (plugin name `playground-ui`):
//   playground-ui/icon-button-size   a <Button> holding only an icon uses an `icon-*` size
//   playground-ui/text-role          typography comes from a DS text role, not Tailwind's text-sm / text-[13px]
//   playground-ui/txt-tone           ink on <Txt> is its `tone` prop, not a text-* colour class
//   playground-ui/font-mono          mono comes from <Txt font="mono">, <InlineCode> or <CodeBlock>
//   playground-ui/no-barrel-imports  import from an exact @mastra/playground-ui subpath, not a broad barrel

// Each option is { selector, message }: report every node an esquery selector matches.
function selectorRule(selectors) {
  return context => {
    const handlers = {};
    for (const { selector, message } of selectors(context.options[0] ?? {})) {
      const previous = handlers[selector];
      handlers[selector] = node => {
        previous?.(node);
        context.report({ node, message });
      };
    }
    return handlers;
  };
}

// A class string is a string literal or a static part of a template literal.
const CLASS_NODES = [
  ['Literal', 'value'],
  ['TemplateElement', 'value.raw'],
];
const classStrings = pattern => CLASS_NODES.map(([node, prop]) => `${node}[${prop}=/${pattern}/]`);

// `>` to the attribute: a descendant match would also flag a coloured child rendered inside a `<Txt>`.
const txtClassStrings = pattern =>
  classStrings(pattern).map(node => `JSXOpeningElement[name.name='Txt'] > JSXAttribute[name.name='className'] ${node}`);

// --- icon-button-size ----------------------------------------------------------------------------------
// A text size (`sm`, `md`, `lg`, or none) pads the button for a label, so an icon on its own renders as a
// pill. `icon-sm|md|lg` is the same height as a square, which the design system rounds into a circle.
// Only literal sizes are checked: a forwarded `size={size}` is the wrapping component's call to make.
// Options: { components: ['Button'] }, the component names to check.

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
  if (node.type === 'ConditionalExpression') {
    return isIconExpression(node.consequent, iconImports) && isIconExpression(node.alternate, iconImports);
  }
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

// --- text-role -----------------------------------------------------------------------------------------
// Typography must come from a DS text role (text-title, text-body, text-label…, or <Txt>). Tailwind's own
// sizes stay defined as a safety net only; the roles live in playground-ui's theme/typography.css.
const TEXT_ROLE_PATTERN = '(^|\\s|:)text-(xs|sm|base|lg|xl|\\dxl)(\\s|$)|text-\\[\\d[^\\]]*(px|rem)\\]';
const TEXT_ROLE_MESSAGE = 'Use a DS text role (text-title / text-body / text-label / text-caption…) — see Txt.';
const textRole = selectorRule(() =>
  classStrings(TEXT_ROLE_PATTERN).map(selector => ({ selector, message: TEXT_ROLE_MESSAGE })),
);

// --- txt-tone ------------------------------------------------------------------------------------------
// Ink on a `<Txt>` is the `tone` prop, not a class: three named tones against any colour Tailwind can
// spell, and omitting tone inherits rather than restating ink. Anchored at class boundaries: a variant or
// an alpha (`hover:text-foreground`, `text-foreground/70`) is something `tone` cannot express, so it stays
// a class.
const TXT_TONE_PATTERN = '(^|\\s)text-(foreground|muted-foreground|placeholder)(?=\\s|$)';
const TXT_TONE_MESSAGE = 'Set ink on <Txt> with tone="ink" | "muted" | "faint", not a text-* colour class.';
const txtTone = selectorRule(() =>
  txtClassStrings(TXT_TONE_PATTERN).map(selector => ({ selector, message: TXT_TONE_MESSAGE })),
);

// --- font-mono -----------------------------------------------------------------------------------------
// By default only `<Txt className>` is checked: native inputs and compound controls keep their className
// escape hatch, and only Txt has a `font` prop. Options:
//   anywhere: true   check every class string instead
//   allowIn: [...]   with `anywhere`, component names whose className may still set font-mono (e.g. 'Input')
const FONT_MONO_PATTERN = '(^|\\s|:|!)font-mono(?=!|\\s|$)';
const FONT_MONO_MESSAGE =
  'Mono comes from the design system: <Txt font="mono"> for identifiers, timestamps, and durations, <InlineCode> or <CodeBlock> for code, tabular-nums for numbers.';
const fontMono = selectorRule(({ anywhere = false, allowIn = [] }) => {
  if (!anywhere) return txtClassStrings(FONT_MONO_PATTERN).map(selector => ({ selector, message: FONT_MONO_MESSAGE }));
  const allowed = `^(${allowIn.join('|')})$`;
  return CLASS_NODES.map(([node, prop]) => {
    const selector = `${node}[${prop}=/${FONT_MONO_PATTERN}/]`;
    return {
      selector: allowIn.length ? `${selector}:not(JSXOpeningElement[name.name=/${allowed}/] ${node})` : selector,
      message: FONT_MONO_MESSAGE,
    };
  });
});

// --- no-barrel-imports ---------------------------------------------------------------------------------
// The root and the components / hooks / utils barrels pull in far more than the one export you need.
// Covers imports, re-exports, and the module argument of vi.mock() / vi.importActual().
const BARREL_SOURCES = [
  '@mastra/playground-ui',
  '@mastra/playground-ui/components',
  '@mastra/playground-ui/hooks',
  '@mastra/playground-ui/utils',
];
const BARREL_MESSAGE = 'Import from an exact @mastra/playground-ui subpath instead of a broad barrel.';
const noBarrelImports = selectorRule(() =>
  BARREL_SOURCES.flatMap(source => [
    `ImportDeclaration[source.value="${source}"]`,
    `ExportNamedDeclaration[source.value="${source}"]`,
    `ExportAllDeclaration[source.value="${source}"]`,
    `CallExpression[callee.object.name="vi"][callee.property.name="mock"] > Literal[value="${source}"]:first-child`,
    `CallExpression[callee.object.name="vi"][callee.property.name="importActual"] > Literal[value="${source}"]:first-child`,
  ]).map(selector => ({ selector, message: BARREL_MESSAGE })),
);

const plugin = {
  meta: { name: 'playground-ui' },
  rules: {
    'icon-button-size': { meta: { type: 'suggestion', schema: false }, create: iconButtonSize },
    'text-role': { meta: { type: 'suggestion', schema: false }, create: textRole },
    'txt-tone': { meta: { type: 'suggestion', schema: false }, create: txtTone },
    'font-mono': { meta: { type: 'suggestion', schema: false }, create: fontMono },
    'no-barrel-imports': { meta: { type: 'suggestion', schema: false }, create: noBarrelImports },
  },
};

// Every rule at its default options. Spread into `rules`, then turn rules off per glob in `overrides`
// (tests and stories, for example).
export const recommended = {
  'playground-ui/icon-button-size': 'error',
  'playground-ui/text-role': 'error',
  'playground-ui/txt-tone': 'error',
  'playground-ui/font-mono': 'error',
  'playground-ui/no-barrel-imports': 'error',
};

export default plugin;
