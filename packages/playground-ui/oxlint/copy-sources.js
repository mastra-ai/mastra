const copyName =
  /(?:label|title|description|message|summary|detail|meta|caption|tooltip|placeholder|context|preview|hint|notice|explanation|content|alt|text)s?$/i;
const technicalName =
  /^(?:classNames?|styles?|schema|instructions|prompt|systemPrompt|sql|script|code|commandOutput|args|regex|pattern)$/i;
const codeElement = /^(?:code|pre|CodeBlock|InlineCode|Markdown|MarkdownRenderer|CodeEditor|JsonEditor)$/;
const functionTypes = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const DELIMITER = 'delimiter';

function nameOf(node) {
  if (node?.type === 'Identifier' || node?.type === 'JSXIdentifier') return node.name;
  if (node?.type === 'Literal') return node.value;
  if (node?.type === 'JSXMemberExpression') return nameOf(node.property);
  return '';
}

function excludedSyntax(node) {
  for (let current = node; current; current = current.parent) {
    if (current.type === 'JSXElement' && codeElement.test(nameOf(current.openingElement.name))) return true;
    if (current.type === 'JSXAttribute' && technicalName.test(nameOf(current.name))) return true;
    if (current.type === 'Property' && technicalName.test(nameOf(current.key))) return true;
    if (current.type === 'VariableDeclarator' && technicalName.test(nameOf(current.id))) return true;
    if (functionTypes.has(current.type) && technicalName.test(nameOf(current.id))) return true;
    if (current.type === 'CallExpression' && nameOf(current.callee) === 'createTool') return true;
    if (current.type === 'AssignmentExpression' && isDocumentTitle(current.left)) return true;
    if (
      current.type === 'AssignmentExpression' &&
      current.left.type === 'MemberExpression' &&
      technicalName.test(nameOf(current.left.object))
    )
      return true;
  }
  return false;
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;|&#0*160;|&#x0*a0;/gi, '\u00a0')
    .replace(/&middot;|&#0*183;|&#x0*b7;/gi, '·')
    .replace(/&mdash;|&#0*8212;|&#x0*2014;/gi, '—');
}

function jsxText(text) {
  const lines = text.split(/\r\n|\n|\r/);
  return lines
    .map((line, index) => {
      let value = line.replace(/\t/g, ' ');
      if (index > 0) value = value.replace(/^ +/, '');
      if (index < lines.length - 1) value = value.replace(/ +$/, '');
      return value;
    })
    .filter(Boolean)
    .join(' ');
}

function hasSiblingValues(node) {
  const children = node.parent.children;
  const index = children.indexOf(node);
  const meaningful = child => {
    if (child.type === 'JSXText') return jsxText(child.value).trim() !== '';
    return child.type !== 'JSXExpressionContainer' || child.expression.type !== 'JSXEmptyExpression';
  };
  return children.slice(0, index).some(meaningful) && children.slice(index + 1).some(meaningful);
}

function isRenderGuard(identifier) {
  const parent = identifier.parent;
  if (parent.type === 'ConditionalExpression') return parent.test === identifier;
  if (parent.type === 'LogicalExpression' && parent.operator === '&&') return parent.left === identifier;
  return false;
}

function isDocumentTitle(node) {
  return node.type === 'MemberExpression' && nameOf(node.object) === 'document' && nameOf(node.property) === 'title';
}

export function copySources(context, check) {
  const roots = new Map();
  const visited = new Map();
  const sources = new Map();
  const excludedBindings = new WeakMap();

  function addRoot(node, separator = false) {
    if (node) roots.set(node, separator || roots.get(node) || false);
  }

  function onlyTechnicalUses(declaration) {
    if (excludedBindings.has(declaration)) return excludedBindings.get(declaration);
    const references = context.sourceCode
      .getDeclaredVariables(declaration)
      .filter(variable => variable.name === nameOf(declaration.id))
      .flatMap(variable => variable.references)
      .filter(reference => reference.isRead() && !isRenderGuard(reference.identifier));
    const excluded = references.length > 0 && references.every(reference => excludedSyntax(reference.identifier));
    excludedBindings.set(declaration, excluded);
    return excluded;
  }

  function ignored(node) {
    if (excludedSyntax(node)) return true;
    for (let current = node; current; current = current.parent) {
      const isBinding = current.type === 'VariableDeclarator' || functionTypes.has(current.type);
      if (isBinding && current.id && onlyTechnicalUses(current)) return true;
    }
    return false;
  }

  function remember(node, text, separator = false) {
    if (ignored(node)) return;
    const jsxValue = node.type === 'JSXText' || node.parent.type === 'JSXAttribute';
    sources.set(node, { text: jsxValue ? decodeEntities(text) : text, separator });
  }

  function resolve(identifier) {
    for (let scope = context.sourceCode.getScope(identifier); scope; scope = scope.upper) {
      const variable = scope.set.get(identifier.name);
      if (variable)
        return variable.defs.filter(definition => definition.type !== 'Parameter').map(definition => definition.node);
    }
    return [];
  }

  function returns(node, separator) {
    if (!node || functionTypes.has(node.type)) return;
    if (node.type === 'ReturnStatement') {
      visit(node.argument, separator);
      return;
    }
    for (const key of context.sourceCode.visitorKeys[node.type] ?? []) {
      const child = node[key];
      if (Array.isArray(child)) child.forEach(value => returns(value, separator));
      else returns(child, separator);
    }
  }

  function visit(node, separator = false) {
    if (!node || ignored(node)) return;
    if (visited.has(node) && (!separator || visited.get(node))) return;
    visited.set(node, separator);
    if (node.type === 'Literal') {
      if (typeof node.value === 'string') remember(node, node.value, separator);
    } else if (node.type === 'TemplateLiteral') {
      const interpolated =
        separator ||
        node.expressions.length > 1 ||
        node.quasis.some(part => (part.value.cooked ?? part.value.raw).trim() !== '');
      for (const part of node.quasis)
        remember(part, part.value.cooked ?? part.value.raw, separator || node.expressions.length > 0);
      node.expressions.forEach(expression => visit(expression, interpolated));
    } else if (node.type === 'Identifier') {
      resolve(node).forEach(definition => visit(definition, separator));
    } else if (node.type === 'VariableDeclarator') {
      visit(node.init, separator);
    } else if (functionTypes.has(node.type)) {
      if (node.body?.type === 'BlockStatement') returns(node.body, separator);
      else visit(node.body, separator);
    } else if (node.type === 'ConditionalExpression') {
      visit(node.consequent, separator);
      visit(node.alternate, separator);
    } else if (node.type === 'LogicalExpression') {
      if (node.operator !== '&&') visit(node.left, separator);
      visit(node.right, node.operator === '&&' || separator === DELIMITER ? separator : false);
    } else if (node.type === 'BinaryExpression' && node.operator === '+') {
      visit(node.left, true);
      visit(node.right, true);
    } else if (node.type === 'ArrayExpression') {
      node.elements.forEach(element => visit(element, separator));
    } else if (node.type === 'CallExpression') {
      const callee = node.callee;
      if (callee.type === 'Identifier') resolve(callee).forEach(definition => visit(definition, separator));
      if (callee.type === 'MemberExpression' && ['join', 'concat'].includes(nameOf(callee.property))) {
        visit(callee.object, separator);
        const argumentContext = nameOf(callee.property) === 'join' ? DELIMITER : true;
        node.arguments.forEach(argument => visit(argument, argumentContext));
      }
      if (callee.type === 'MemberExpression' && ['map', 'flatMap'].includes(nameOf(callee.property))) {
        node.arguments.forEach(argument => visit(argument, separator));
      }
    } else if (
      ['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'ChainExpression'].includes(node.type)
    ) {
      visit(node.expression, separator);
    }
  }

  return {
    JSXText(node) {
      remember(node, jsxText(node.value), hasSiblingValues(node));
    },
    JSXExpressionContainer(node) {
      if (node.parent.type === 'JSXElement' || node.parent.type === 'JSXFragment')
        addRoot(node.expression, hasSiblingValues(node));
    },
    JSXAttribute(node) {
      if (copyName.test(nameOf(node.name))) addRoot(node.value?.expression ?? node.value);
    },
    Property(node) {
      if (!node.computed && copyName.test(nameOf(node.key))) addRoot(node.value);
    },
    VariableDeclarator(node) {
      if (copyName.test(nameOf(node.id))) addRoot(node);
    },
    FunctionDeclaration(node) {
      if (copyName.test(nameOf(node.id))) addRoot(node);
    },
    AssignmentPattern(node) {
      if (copyName.test(nameOf(node.left))) addRoot(node.right);
    },
    AssignmentExpression(node) {
      const target = node.left.type === 'MemberExpression' ? node.left.property : node.left;
      if (copyName.test(nameOf(target))) addRoot(node.right);
    },
    CallExpression(node) {
      const callee = node.callee;
      const isToast =
        nameOf(callee) === 'toast' || (callee.type === 'MemberExpression' && nameOf(callee.object) === 'toast');
      if (isToast) addRoot(node.arguments[0]);
    },
    'Program:exit'() {
      roots.forEach((separator, root) => visit(root, separator));
      for (const [node, source] of sources) check(node, source);
    },
  };
}
