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
//   playground-ui/button-icon-prop   an icon beside a <Button>'s label is its `icon` / `iconEnd`, not a child
//   playground-ui/button-loading     a <Button> shows loading through `loading`: no loader inside, the label stays
//   playground-ui/text-role          typography comes from a DS text role, not Tailwind's text-sm / text-[13px]
//   playground-ui/txt-tone           ink on <Txt> is its `tone` prop, not a text-* colour class
//   playground-ui/font-mono          mono comes from <Txt font="mono">, <InlineCode> or <CodeBlock>
//   playground-ui/no-barrel-imports  import from an exact @mastra/playground-ui subpath, not a broad barrel
//   playground-ui/placeholder-text   placeholders use sentence case and no trailing ellipsis ("Search agents")
//   playground-ui/no-text-separators      metadata uses separate elements and a gap, not · — | • between fields
//   playground-ui/no-text-layout-spacing  layout comes from a gap, not repeated spaces or NBSPs in copy
//   playground-ui/no-page-width      a page takes its width from PageLayout, not a centred max-w-* column
//   playground-ui/page-layout-props  every PageLayout names a variant and passes only the props that variant takes

import { noTextLayoutSpacing, noTextSeparators } from './copy-rules.js';

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

// --- button-icon-prop ----------------------------------------------------------------------------------
// An icon beside a button's label goes through `icon` (before the label) or `iconEnd` (after it). The slot
// sizes and spaces it, and the button knows which child is its icon. An icon between two parts of a label
// stays a child, and so does anything that isn't an icon: an avatar, a badge, a key hint.
// Options: { components: { Button: ['icon', 'iconEnd'] } }, the components to check and the props each takes.
const BUTTON_ICON_PROPS = {
  Button: ['icon', 'iconEnd'],
  DialogAction: ['icon', 'iconEnd'],
  'Notice.Button': ['icon'],
  'JSONSchemaForm.AddField': ['icon', 'iconEnd'],
};

const jsxName = name =>
  name.type === 'JSXMemberExpression' ? `${jsxName(name.object)}.${name.property.name}` : (name.name ?? '');

const isBlank = node =>
  (node.type === 'JSXText' && !node.value.trim()) ||
  (node.type === 'JSXExpressionContainer' && node.expression.type === 'JSXEmptyExpression') ||
  (node.type === 'JSXExpressionContainer' &&
    node.expression.type === 'Literal' &&
    typeof node.expression.value === 'string' &&
    !node.expression.value.trim());

const isNothing = node =>
  (node.type === 'Literal' && (node.value === null || node.value === false || node.value === '')) ||
  (node.type === 'Identifier' && node.name === 'undefined');

// What a child can turn into: the branches of a condition, without the ones that render nothing.
function branches(node) {
  switch (node.type) {
    case 'JSXExpressionContainer':
    case 'TSAsExpression':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return branches(node.expression);
    case 'ConditionalExpression':
      return [...branches(node.consequent), ...branches(node.alternate)];
    case 'LogicalExpression':
      return node.operator === '&&' ? branches(node.right) : [...branches(node.left), ...branches(node.right)];
    default:
      return isNothing(node) ? [] : [node];
  }
}

const contentOf = node => node.children.filter(child => !isBlank(child) && branches(child).length > 0);

// `<Icon>` and a bare `<span>` around an icon are the icon.
function isIcon(node, iconImports) {
  switch (node.type) {
    case 'JSXElement': {
      const name = jsxName(node.openingElement.name);
      if (name === 'svg' || isIconName(name, iconImports) || /(^|\.)icon$/i.test(name)) return true;
      const content = contentOf(node);
      return name === 'span' && content.length > 0 && content.every(child => isIconChild(child, iconImports));
    }
    case 'JSXFragment': {
      const content = contentOf(node);
      return content.length > 0 && content.every(child => isIconChild(child, iconImports));
    }
    case 'Identifier':
      return /^icon$|Icon$/.test(node.name);
    case 'MemberExpression':
      return !node.computed && /^icon$|Icon$/.test(node.property.name);
    case 'ChainExpression':
      return isIcon(node.expression, iconImports);
    default:
      return false;
  }
}

function isIconChild(child, iconImports) {
  const options = branches(child);
  return options.length > 0 && options.every(option => isIcon(option, iconImports));
}

// The icons at one end of a label, looking inside fragments and the branches of a condition.
function iconsAtEdge(content, side, iconImports) {
  if (content.length === 0 || content.every(child => isIconChild(child, iconImports))) return [];
  const edge = side === 'icon' ? content[0] : content.at(-1);
  if (isIconChild(edge, iconImports)) return [edge];
  return branches(edge).flatMap(option =>
    option.type === 'JSXFragment' ? iconsAtEdge(contentOf(option), side, iconImports) : [],
  );
}

// Every value the attribute can take is a literal text size (`size={compact ? 'sm' : 'md'}` counts).
const isTextSize = value =>
  value !== null &&
  (value.type === 'Literal' ? [value] : branches(value)).every(
    option => option.type === 'Literal' && typeof option.value === 'string' && !option.value.startsWith('icon-'),
  );

const setsSize = attribute => attribute.type === 'JSXSpreadAttribute' || attribute.name.name === 'size';

function buttonIconProp(context) {
  const { components = BUTTON_ICON_PROPS } = context.options[0] ?? {};
  const iconImports = new Set();
  return {
    ImportDeclaration(node) {
      if (!iconModulePattern.test(node.source.value)) return;
      for (const specifier of node.specifiers) iconImports.add(specifier.local.name);
    },
    JSXElement(node) {
      const { openingElement } = node;
      const name = jsxName(openingElement.name);
      if (!Object.hasOwn(components, name)) return;
      const attributes = new Map();
      for (const attribute of openingElement.attributes)
        if (attribute.type === 'JSXAttribute') attributes.set(attribute.name.name, attribute.value);
      // An icon size ignores the props: its child is the glyph. A forwarded or spread size may be one.
      if (attributes.has('size') && !isTextSize(attributes.get('size'))) return;
      if (openingElement.attributes.findLast(setsSize)?.type === 'JSXSpreadAttribute') return;
      const content = contentOf(node);
      for (const prop of components[name]) {
        if (attributes.has(prop)) continue;
        for (const icon of iconsAtEdge(content, prop, iconImports)) {
          // A loader belongs to `loading`, not to `icon`: button-loading reports it.
          if (holdsLoader(icon)) continue;
          context.report({
            node: icon,
            message: `Pass this icon through <${name}>'s \`${prop}\` prop, not as a child beside the label.`,
          });
        }
      }
    },
  };
}

// --- button-loading ------------------------------------------------------------------------------------
// A button shows that its action is running through `loading` alone: no loader of its own inside, and a label
// that stays the same. A label is only held against the expression its button's `loading` gets, so one that
// changes with any other state is fine.
// Options: { components: ['Button'] }, the component names to check.
const LOADING_BUTTONS = [...Object.keys(BUTTON_ICON_PROPS), 'AlertDialog.Action'];

function attributesOf(element) {
  const attributes = new Map();
  for (const attribute of element.openingElement.attributes)
    if (attribute.type === 'JSXAttribute') attributes.set(jsxName(attribute.name), attribute);
  return attributes;
}

// A `Spinner`, or any glyph that spins.
function isLoader(node) {
  if (node.type !== 'JSXElement') return false;
  if (jsxName(node.openingElement.name) === 'Spinner') return true;
  const className = attributesOf(node).get('className')?.value;
  return classValues(className).some(value => /(^|[\s:])animate-spin(\s|$)/.test(value));
}

// Is a loader in there, under any wrapper or condition?
const holdsLoader = node =>
  branches(node).some(
    option =>
      isLoader(option) ||
      ((option.type === 'JSXElement' || option.type === 'JSXFragment') && option.children.some(holdsLoader)),
  );

function buttonLoading(context) {
  const { components = LOADING_BUTTONS } = context.options[0] ?? {};
  const names = new Set(components);
  const iconImports = new Set();
  const { sourceCode } = context;

  // What `const label = …` holds. A prop, a destructured value or anything reassignable stays unknown.
  function constantValue(identifier) {
    for (let scope = sourceCode.getScope(identifier); scope; scope = scope.upper) {
      const variable = scope.set.get(identifier.name);
      if (!variable) continue;
      const declarator = variable.defs.length === 1 ? variable.defs[0].node : undefined;
      if (declarator?.type !== 'VariableDeclarator' || declarator.parent.kind !== 'const') return undefined;
      return declarator.id.type === 'Identifier' ? declarator.init : undefined;
    }
    return undefined;
  }

  // The pieces a node renders: its children, the results of its conditions, the values in its template. Props,
  // callbacks and tests render nothing.
  function parts(node) {
    switch (node.type) {
      case 'JSXExpressionContainer':
      case 'TSAsExpression':
      case 'TSNonNullExpression':
      case 'ParenthesizedExpression':
        return [node.expression];
      case 'JSXElement':
      case 'JSXFragment':
        return node.children;
      case 'ArrayExpression':
        return node.elements.filter(Boolean);
      case 'ConditionalExpression':
        return [node.consequent, node.alternate];
      case 'LogicalExpression':
        return node.operator === '&&' ? [node.right] : [node.left, node.right];
      case 'BinaryExpression':
        return [node.left, node.right];
      case 'TemplateLiteral':
        return node.expressions;
      case 'Identifier': {
        const value = constantValue(node);
        return value ? [value] : [];
      }
      default:
        return [];
    }
  }

  const loadersIn = node => (isLoader(node) ? [node] : parts(node).flatMap(loadersIn));

  function hasText(node) {
    if (isIcon(node, iconImports)) return false;
    switch (node.type) {
      case 'JSXText':
        return node.value.trim() !== '';
      case 'Literal':
        return typeof node.value === 'number' || (typeof node.value === 'string' && node.value.trim() !== '');
      case 'Identifier':
        return node.name !== 'undefined' && (constantValue(node) ? parts(node).some(hasText) : true);
      case 'TemplateLiteral':
      case 'MemberExpression':
      case 'ChainExpression':
      case 'CallExpression':
        return true;
      default:
        return parts(node).some(hasText);
    }
  }

  // The expression behind a constant, `!!`, `Boolean()` and TypeScript's wrappers.
  function unwrap(node) {
    switch (node.type) {
      case 'JSXExpressionContainer':
      case 'ChainExpression':
      case 'TSAsExpression':
      case 'TSNonNullExpression':
      case 'ParenthesizedExpression':
        return unwrap(node.expression);
      case 'UnaryExpression':
        return isNot(node) && isNot(node.argument) ? unwrap(node.argument.argument) : node;
      case 'CallExpression':
        return node.callee.name === 'Boolean' && node.arguments.length === 1 ? unwrap(node.arguments[0]) : node;
      case 'Identifier': {
        const value = constantValue(node);
        return value ? unwrap(value) : node;
      }
      default:
        return node;
    }
  }

  const isNot = node => node.type === 'UnaryExpression' && node.operator === '!';
  const textOf = node => sourceCode.getText(unwrap(node)).replace(/\s+/g, '').replaceAll('?.', '.');

  function opposite(value) {
    if (value.type !== 'BinaryExpression' || !/^[!=]==?$/.test(value.operator)) return `!${textOf(value)}`;
    const operator = value.operator.replace(/^[!=]/, sign => (sign === '!' ? '=' : '!'));
    return `${textOf(value.left)}${operator}${textOf(value.right)}`;
  }

  function operands(node, operator) {
    const value = unwrap(node);
    if (value.type !== 'LogicalExpression' || value.operator !== operator) return [value];
    return [...operands(value.left, operator), ...operands(value.right, operator)];
  }

  // The expressions that are true only while the button loads: what `loading` gets, and each side of its `||`.
  function loadingStates(element, attributes) {
    const value = attributes.has('loading') ? attributes.get('loading').value : dialogPending(element);
    if (!value || value.type === 'Literal') return undefined;
    const expression = unwrap(value);
    if (expression.type === 'Literal') return undefined;
    return new Set([expression, ...operands(expression, '||')].map(textOf));
  }

  // A DialogAction without `loading` takes its Dialog's `pending`.
  function dialogPending(element) {
    if (jsxName(element.openingElement.name) !== 'DialogAction') return undefined;
    for (let node = element.parent; node; node = node.parent)
      if (node.type === 'JSXElement' && jsxName(node.openingElement.name) === 'Dialog')
        return attributesOf(node).get('pending')?.value;
    return undefined;
  }

  // Does the button starting to load decide the test? `!saving && saved` isn't decided by `saving`, it only holds
  // the finished label back until then.
  function isDecidedBy(states, test) {
    const value = unwrap(test);
    if (states.has(textOf(value)) || states.has(opposite(value))) return true;
    if (isNot(value)) return isDecidedBy(states, value.argument);
    if (value.type !== 'LogicalExpression') return false;
    if (value.operator === '||') return operands(value, '||').some(side => isDecidedBy(states, side));
    return operands(value, '&&').some(side => states.has(textOf(side)));
  }

  function changesWith(states, node) {
    const changes =
      node.type === 'ConditionalExpression'
        ? textOf(node.consequent) !== textOf(node.alternate) &&
          parts(node).some(hasText) &&
          isDecidedBy(states, node.test)
        : node.type === 'LogicalExpression' &&
          node.operator === '&&' &&
          hasText(node.right) &&
          isDecidedBy(states, node.left);
    return changes || parts(node).some(part => changesWith(states, part));
  }

  // Its content, and the props that name it. An icon button without an `aria-label` is named by its tooltip.
  function labelsOf(element, attributes) {
    const labels = [...element.children, attributes.get('children'), attributes.get('aria-label')];
    const size = literalAttribute(attributes.get('size')?.value);
    const isIconButton =
      String(size).startsWith('icon-') ||
      (element.children.length > 0 && hasOnlyIconChildren(element.children, iconImports));
    if (isIconButton && !attributes.has('aria-label')) labels.push(attributes.get('tooltip'));
    return labels.filter(label => label && (label.type !== 'JSXAttribute' || label.value));
  }

  return {
    ImportDeclaration(node) {
      if (!iconModulePattern.test(node.source.value)) return;
      for (const specifier of node.specifiers) iconImports.add(specifier.local.name);
    },
    JSXElement(node) {
      const name = jsxName(node.openingElement.name);
      if (!names.has(name)) return;
      const attributes = attributesOf(node);
      const content = [...node.children, ...['children', 'icon', 'iconEnd'].map(prop => attributes.get(prop)?.value)];
      for (const loader of content.filter(Boolean).flatMap(loadersIn))
        context.report({
          node: loader,
          message: `Show loading with <${name}>'s \`loading\` prop, not a loader inside it.`,
        });
      const states = loadingStates(node, attributes);
      if (!states) return;
      for (const label of labelsOf(node, attributes))
        if (changesWith(states, label.type === 'JSXAttribute' ? label.value : label))
          context.report({
            node: label,
            message: `Keep <${name}>'s label the same while it loads: \`loading\` already shows it.`,
          });
    },
  };
}

const ICON_SIZE_CLASS = /(^|\s|:)(size|h|w)-(?!(icon-(xs|sm|md|lg)|full|auto|\[[\d.]+em\])(\s|$))\S+/;
const ICON_SIZE_MESSAGE =
  'Size an icon from its parent component or an <Icon size> wrapper, or with a size-icon-* class, not a size of its own.';

function classValues(node) {
  if (!node) return [];
  switch (node.type) {
    case 'Literal':
      return [String(node.value)];
    case 'TemplateLiteral':
      return [...node.quasis.map(quasi => quasi.value.raw), ...node.expressions.flatMap(classValues)];
    case 'JSXExpressionContainer':
      return classValues(node.expression);
    case 'CallExpression':
      return node.arguments.flatMap(classValues);
    case 'ArrayExpression':
      return node.elements.flatMap(classValues);
    case 'ObjectExpression':
      return node.properties.flatMap(property => (property.type === 'Property' ? classValues(property.key) : []));
    case 'ConditionalExpression':
      return [...classValues(node.consequent), ...classValues(node.alternate)];
    case 'LogicalExpression':
      return [...classValues(node.left), ...classValues(node.right)];
    default:
      return [];
  }
}

function iconSizeFromParent(context) {
  const iconImports = new Set();
  return {
    ImportDeclaration(node) {
      if (!iconModulePattern.test(node.source.value)) return;
      for (const specifier of node.specifiers)
        if (specifier.local.name !== 'Icon') iconImports.add(specifier.local.name);
    },
    JSXOpeningElement(node) {
      if (node.name.type !== 'JSXIdentifier' || !iconImports.has(node.name.name)) return;
      for (const attribute of node.attributes) {
        if (attribute.type !== 'JSXAttribute' || attribute.name.type !== 'JSXIdentifier') continue;
        const name = attribute.name.name;
        const sized =
          (['size', 'width', 'height'].includes(name) && literalAttribute(attribute.value) !== undefined) ||
          (name === 'className' && classValues(attribute.value).some(value => ICON_SIZE_CLASS.test(value)));
        if (sized) context.report({ node: attribute, message: ICON_SIZE_MESSAGE });
      }
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

// --- placeholder-text ----------------------------------------------------------------------------------
// Placeholders read like the system search field on macOS and iOS: "Search agents", "Search by name". No
// trailing ellipsis (`…` or `...`): the dimmed text already says the field is empty. Placeholders that give
// an instruction (start with Search, Filter, Select…) also use sentence case. Example values ("My Agent",
// "e.g. Production alerts") keep their capitals.
// Checks string `placeholder` / `*Placeholder` values in JSX attributes, object properties, default
// parameters and variables, including each branch of a ternary. Strings built at runtime are only partly seen.
// Options: { properNouns?: string[] } words that stay capitalized after the first, added to the defaults.
const PLACEHOLDER_NAME = /^placeholder$|Placeholder$/;
const INSTRUCTION_VERBS =
  /^(Search|Filter|Find|Select|Choose|Pick|Enter|Type|Paste|Add|Write|Describe|Leave|Ask|Send|Name)\b/;
const PLACEHOLDER_PROPER_NOUNS = [
  'Mastra Code',
  'Mastra',
  'Studio',
  'Factory',
  'Factories',
  'MastraCode',
  'GitHub',
  'GitLab',
  'Google',
  'Slack',
  'Linear',
  'Vercel',
  'Stripe',
];

// The string values a placeholder expression can take: literals, static template parts, ternary branches.
function placeholderStrings(node) {
  if (!node) return [];
  if (node.type === 'JSXExpressionContainer') return placeholderStrings(node.expression);
  if (node.type === 'Literal' && typeof node.value === 'string') return [{ node, head: node.value, tail: node.value }];
  if (node.type === 'TemplateLiteral') {
    const { quasis } = node;
    return [{ node, head: quasis[0].value.cooked, tail: quasis[quasis.length - 1].value.cooked }];
  }
  if (node.type === 'ConditionalExpression')
    return [...placeholderStrings(node.consequent), ...placeholderStrings(node.alternate)];
  if (node.type === 'LogicalExpression') return placeholderStrings(node.right);
  return [];
}

function placeholderText(context) {
  const nouns = [...PLACEHOLDER_PROPER_NOUNS, ...(context.options[0]?.properNouns ?? [])];
  const properNouns = new RegExp(`\\b(?:${nouns.sort((a, b) => b.length - a.length).join('|')})\\b`, 'g');
  // The first capitalized word that doesn't start a sentence and isn't (part of) a proper noun.
  const titleCaseWord = text => {
    let sentenceStart = true;
    for (const word of text.replace(properNouns, 'x').trim().split(/\s+/)) {
      if (!sentenceStart && /^[A-Z][a-z]/.test(word)) return word;
      sentenceStart = /[.!?:]$/.test(word);
    }
    return null;
  };
  const check = value => {
    for (const { node, head, tail } of placeholderStrings(value)) {
      // A progress state shown in the field ("Loading agents…") keeps its ellipsis.
      if (/(…|\.\.\.)\s*$/.test(tail) && !/^\s*\w+ing\b/.test(head)) {
        context.report({ node, message: 'Drop the trailing ellipsis from this placeholder ("Search agents").' });
      }
      if (!INSTRUCTION_VERBS.test(head)) continue;
      const word = titleCaseWord(head);
      if (word) {
        context.report({
          node,
          message: `Use sentence case in this placeholder: lowercase "${word.replace(/[^A-Za-z]+$/, '')}" unless it's a proper noun (add it to properNouns).`,
        });
      }
    }
  };
  const keyName = key => (key?.type === 'Identifier' ? key.name : key?.type === 'Literal' ? key.value : '');
  return {
    JSXAttribute(node) {
      if (node.name.type === 'JSXIdentifier' && PLACEHOLDER_NAME.test(node.name.name)) check(node.value);
    },
    Property(node) {
      if (PLACEHOLDER_NAME.test(keyName(node.key))) check(node.value);
    },
    AssignmentPattern(node) {
      if (node.left.type === 'Identifier' && PLACEHOLDER_NAME.test(node.left.name)) check(node.right);
    },
    VariableDeclarator(node) {
      if (node.id.type === 'Identifier' && PLACEHOLDER_NAME.test(node.id.name)) check(node.init);
    },
  };
}

// How to pick a PageLayout variant, shared by every message that sends someone to one.
const PICK_PAGE_VARIANT =
  'variant="form" for a create or edit form (title and back link, no breadcrumbs), variant="settings" for a settings page (breadcrumbs, title, sections), variant="page" for anything else, adding body="fixed" when its panels scroll on their own (chat, board, editor, graph).';

const PAGE_WIDTH_MESSAGE = `Let PageLayout set the page width instead of building a centred max-w-* column. Use ${PICK_PAGE_VARIANT}`;

const centredPageColumn = classStrings('^(?=[\\s\\S]*(^|\\s)mx-auto(\\s|$))(?=[\\s\\S]*(^|\\s)max-w-)');
const noPageWidth = selectorRule(() => centredPageColumn.map(selector => ({ selector, message: PAGE_WIDTH_MESSAGE })));

const PAGE_SPACING_MESSAGE = cls =>
  `Drop ${cls}: PageLayout puts 16px under the header and 48px at the end of the page. Stack the page's sections with gap-6 (or space-y-6) and nothing else.`;

const SPACING_UTILITY = /^-?(m|p)[xytrblse]?-/;
const COLUMN_GAP_UTILITY = /^(space-y|gap-y|gap)-(.+)$/;

const alternative = (literals = [], assumes = new Map()) => ({ literals, assumes });

function merge(a, b) {
  const assumes = new Map(a.assumes);
  for (const [test, value] of b.assumes) {
    if (assumes.has(test) && assumes.get(test) !== value) return null;
    assumes.set(test, value);
  }
  return alternative([...a.literals, ...b.literals], assumes);
}

const product = parts =>
  parts.reduce(
    (combos, options) => combos.flatMap(combo => options.map(option => merge(combo, option)).filter(Boolean)),
    [alternative()],
  );

const assuming = (options, test, value) =>
  options.map(option => merge(option, alternative([], new Map([[test, value]])))).filter(Boolean);

function classAlternatives(node, source) {
  if (!node) return [alternative()];
  const next = child => classAlternatives(child, source);
  if (node.type === 'Literal' && /^['"]/.test(node.raw)) return [alternative([{ node, text: node.value }])];
  if (node.type === 'TemplateLiteral')
    return product([
      [alternative(node.quasis.map(quasi => ({ node: quasi, text: quasi.value.raw })))],
      ...node.expressions.map(next),
    ]);
  if (node.type === 'JSXExpressionContainer' || node.type === 'ParenthesizedExpression') return next(node.expression);
  if (node.type === 'LogicalExpression') {
    if (node.operator !== '&&') return [...next(node.left), ...next(node.right)];
    const test = source.getText(node.left);
    return [...assuming([alternative()], test, false), ...assuming(next(node.right), test, true)];
  }
  if (node.type === 'ConditionalExpression') {
    const test = source.getText(node.test);
    return [...assuming(next(node.consequent), test, true), ...assuming(next(node.alternate), test, false)];
  }
  if (node.type === 'CallExpression') return product(node.arguments.map(next));
  if (node.type === 'ArrayExpression') return product(node.elements.map(next));
  return [alternative()];
}

function pageRoots(node, { throughFragments = true } = {}, roots = []) {
  if (!node) return roots;
  const next = child => pageRoots(child, { throughFragments }, roots);
  if (node.type === 'JSXElement') roots.push(node);
  else if (node.type === 'JSXFragment' && throughFragments) node.children.forEach(next);
  else if (node.type === 'JSXExpressionContainer' || node.type === 'ParenthesizedExpression') next(node.expression);
  else if (node.type === 'LogicalExpression') next(node.right);
  else if (node.type === 'ConditionalExpression') {
    next(node.consequent);
    next(node.alternate);
  }
  return roots;
}

function stacksColumn(classes) {
  if (classes.some(cls => cls.startsWith('space-y-') || cls.startsWith('gap-y-'))) return true;
  if (classes.includes('flex-col')) return true;
  return classes.includes('grid') && !classes.some(cls => cls.startsWith('grid-cols-') && cls !== 'grid-cols-1');
}

function noPageSpacing(context) {
  const check = (root, isBody) => {
    const attribute = root.openingElement.attributes.find(
      item => item.type === 'JSXAttribute' && item.name.name === 'className',
    );
    if (!attribute) return;
    const reported = new Map();
    for (const { literals } of classAlternatives(attribute.value, context.sourceCode)) {
      const classes = literals.flatMap(({ text }) => text.split(/\s+/)).map(cls => cls.split(':').pop());
      const column = stacksColumn(classes);
      for (const { node, text } of literals) {
        for (const raw of text.split(/\s+/).filter(Boolean)) {
          const cls = raw.split(':').pop();
          const gap = COLUMN_GAP_UTILITY.exec(cls);
          const spacing = SPACING_UTILITY.test(cls) && cls !== 'mx-auto';
          const offRhythmGap = isBody && gap && (gap[1] !== 'gap' || column) && gap[2] !== '6';
          const seen = reported.get(node) ?? new Set();
          if (!(spacing || offRhythmGap) || seen.has(raw)) continue;
          reported.set(node, seen.add(raw));
          context.report({ node, message: PAGE_SPACING_MESSAGE(raw) });
        }
      }
    }
  };
  return {
    JSXElement(node) {
      const { name } = node.openingElement;
      if (name.type !== 'JSXIdentifier' || name.name !== 'PageLayout') return;
      const attribute = attributeName =>
        node.openingElement.attributes.find(item => item.type === 'JSXAttribute' && item.name.name === attributeName);
      const fixedBody = literalAttribute(attribute('body')?.value) === 'fixed';
      if (!fixedBody) for (const child of node.children) for (const root of pageRoots(child)) check(root, true);
      for (const root of pageRoots(attribute('header')?.value, { throughFragments: false })) check(root, false);
    },
  };
}

const PAGE_LAYOUT = "JSXOpeningElement[name.name='PageLayout']";
// The variants PageLayout used to take, and what each became.
const REMOVED_PAGE_LAYOUT_VARIANTS = {
  container: `PageLayout has no container variant. Use ${PICK_PAGE_VARIANT}`,
  fit: 'PageLayout has no fit variant. Use variant="page" body="fixed": the page stays put and its panels scroll on their own.',
  narrow:
    'PageLayout has no narrow variant. Use variant="form" for a create or edit form (title and back link, no breadcrumbs) or variant="settings" for a settings page (breadcrumbs, title, sections). A list or dashboard takes variant="page".',
};
// Props a variant does not take. TypeScript rejects these too, but its union error does not say what to do instead.
const PROPS_OFF_VARIANT = [
  [
    'form',
    'breadcrumbs|headerActions|actionRow|header',
    'A form has no breadcrumbs, header actions or header: its way out is the back link (backHref, backLabel) and its title is `title`. If this is not a create or edit form, use variant="settings" or variant="page".',
  ],
  ['form', 'body', 'Only variant="page" takes body. A form is a 640px column that scrolls with the page.'],
  ['settings', 'body', 'Only variant="page" takes body. A settings page is a 640px column that scrolls with the page.'],
];
const pageLayoutProps = selectorRule(() => [
  {
    selector: `${PAGE_LAYOUT}:not(:has(> JSXAttribute[name.name='variant'], > JSXSpreadAttribute))`,
    message: `PageLayout needs a variant. Use ${PICK_PAGE_VARIANT}`,
  },
  ...Object.entries(REMOVED_PAGE_LAYOUT_VARIANTS).map(([value, message]) => ({
    selector: `${PAGE_LAYOUT} > JSXAttribute[name.name='variant'][value.value='${value}']`,
    message,
  })),
  ...PROPS_OFF_VARIANT.map(([variant, props, message]) => ({
    selector: `${PAGE_LAYOUT}:has(> JSXAttribute[name.name='variant'][value.value='${variant}']) > JSXAttribute[name.name=/^(${props})$/]`,
    message,
  })),
  { selector: `${PAGE_LAYOUT} > JSXAttribute[name.name='mask']`, message: 'PageLayout has no mask. Drop the prop.' },
]);

const plugin = {
  meta: { name: 'playground-ui' },
  rules: {
    'icon-button-size': { meta: { type: 'suggestion', schema: false }, create: iconButtonSize },
    'button-icon-prop': { meta: { type: 'suggestion', schema: false }, create: buttonIconProp },
    'button-loading': { meta: { type: 'suggestion', schema: false }, create: buttonLoading },
    'icon-size-from-parent': { meta: { type: 'suggestion', schema: false }, create: iconSizeFromParent },
    'text-role': { meta: { type: 'suggestion', schema: false }, create: textRole },
    'txt-tone': { meta: { type: 'suggestion', schema: false }, create: txtTone },
    'font-mono': { meta: { type: 'suggestion', schema: false }, create: fontMono },
    'no-barrel-imports': { meta: { type: 'suggestion', schema: false }, create: noBarrelImports },
    'placeholder-text': { meta: { type: 'suggestion', schema: false }, create: placeholderText },
    'no-text-separators': noTextSeparators,
    'no-text-layout-spacing': noTextLayoutSpacing,
    'no-page-width': { meta: { type: 'suggestion', schema: false }, create: noPageWidth },
    'page-layout-props': { meta: { type: 'problem', schema: false }, create: pageLayoutProps },
    'no-page-spacing': { meta: { type: 'suggestion', schema: false }, create: noPageSpacing },
  },
};

export const copyRules = {
  'playground-ui/no-text-separators': 'error',
  'playground-ui/no-text-layout-spacing': 'error',
};

export const pageRules = {
  'playground-ui/no-page-width': 'error',
};

export const copyRuleExclusions = {
  files: ['**/*.{test,spec,stories,story}.*', '**/{test,tests,__tests__,__mocks__,__fixtures__,fixtures,generated}/**'],
  rules: Object.fromEntries(Object.keys(copyRules).map(rule => [rule, 'off'])),
};

// Every rule at its default options. Spread into `rules`, then turn rules off per glob in `overrides`
// (tests and stories, for example).
export const recommended = {
  'playground-ui/icon-button-size': 'error',
  'playground-ui/button-icon-prop': 'error',
  'playground-ui/button-loading': 'error',
  'playground-ui/icon-size-from-parent': 'error',
  'playground-ui/text-role': 'error',
  'playground-ui/txt-tone': 'error',
  'playground-ui/font-mono': 'error',
  'playground-ui/no-barrel-imports': 'error',
  'playground-ui/placeholder-text': 'error',
  'playground-ui/page-layout-props': 'error',
  'playground-ui/no-page-spacing': 'error',
  ...copyRules,
};

export default plugin;
