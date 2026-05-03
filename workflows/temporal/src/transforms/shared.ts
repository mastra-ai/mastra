import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import * as t from '@babel/types';

export const parserPlugins = [
  'typescript',
  'jsx',
  'classProperties',
  'classPrivateProperties',
  'classPrivateMethods',
  'topLevelAwait',
  'importAttributes',
  'decorators-legacy',
] as const;
export function parseModule(filePath: string, sourceText?: string): t.File {
  if (!sourceText) {
    sourceText = readFileSync(filePath, 'utf8');
  }

  return parse(sourceText, {
    sourceType: 'module',
    plugins: parserPlugins as any,
    sourceFilename: filePath,
  });
}

export function isIdentifierNamed(node: t.Node, name: string): boolean {
  return t.isIdentifier(node) && node.name === name;
}

export function isTemporalHelperModule(source: string): boolean {
  return typeof source === 'string' && /(^|\/)temporal\.(ts|tsx|js|jsx|mts|mjs)$/.test(source);
}

export const strippedExternalModules = new Set(['@temporalio/client', '@temporalio/envconfig']);

export function isStrippedExternalModule(source: string): boolean {
  return typeof source === 'string' && strippedExternalModules.has(source);
}

export function collectImportedNames(statement: t.ImportDeclaration): Set<string> {
  const names = new Set<string>();

  for (const specifier of statement.specifiers) {
    if (
      t.isImportDefaultSpecifier(specifier) ||
      t.isImportNamespaceSpecifier(specifier) ||
      t.isImportSpecifier(specifier)
    ) {
      if (t.isIdentifier(specifier.local)) {
        names.add(specifier.local.name);
      }
    }
  }

  return names;
}

export function nodeReferencesName(node: t.Node, names: Set<string>): boolean {
  let found = false;

  walk(node, current => {
    if (t.isIdentifier(current) && names.has(current.name)) {
      found = true;
      return false;
    }
  });

  return found;
}

export function isWorkflowHelperDestructure(declaration: t.VariableDeclarator): boolean {
  if (!t.isObjectPattern(declaration.id)) {
    return false;
  }

  return declaration.id.properties.some(
    property =>
      t.isObjectProperty(property) &&
      !property.computed &&
      t.isIdentifier(property.value) &&
      (property.value.name === 'createStep' || property.value.name === 'createWorkflow'),
  );
}

export function isCreateWorkflowCall(node: t.Node): node is t.CallExpression {
  return t.isCallExpression(node) && isIdentifierNamed(node.callee, 'createWorkflow');
}

export function isCreateStepCall(node: t.Node): node is t.CallExpression {
  return t.isCallExpression(node) && isIdentifierNamed(node.callee, 'createStep');
}

export function getObjectPropertyName(property: t.ObjectProperty | t.ObjectMethod): string | null {
  if (property.computed) {
    return null;
  }

  if (t.isIdentifier(property.key)) {
    return property.key.name;
  }

  if (t.isStringLiteral(property.key)) {
    return property.key.value;
  }

  return null;
}

export function walk(node: t.Node | null | undefined, visitor: (node: t.Node) => false | void): void {
  if (!node) {
    return;
  }

  const result = visitor(node);
  if (result === false) {
    return;
  }

  const keys = (t.VISITOR_KEYS as Record<string, string[]>)[node.type] ?? [];
  for (const key of keys) {
    const value = (node as unknown as Record<string, unknown>)[key];

    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof (child as t.Node).type === 'string') {
          walk(child as t.Node, visitor);
        }
      }
      continue;
    }

    if (value && typeof (value as t.Node).type === 'string') {
      walk(value as t.Node, visitor);
    }
  }
}

export function hasCreateWorkflowCall(node: t.Node): boolean {
  let found = false;

  walk(node, current => {
    if (isCreateWorkflowCall(current)) {
      found = true;
      return false;
    }
  });

  return found;
}

export function getStepNameFromCall(node: t.CallExpression): string | null {
  const stepId = getCreateStepId(node);
  if (!stepId) {
    return null;
  }

  return stepId
    .replace(/[^a-zA-Z0-9]+(.)/g, (_match, char: string) => char.toUpperCase())
    .replace(/^[^a-zA-Z_$]+/, '')
    .replace(/^(.)/, (char: string) => char.toLowerCase());
}

export function createExportedStepStatement(name: string, initializer: t.Expression): t.ExportNamedDeclaration {
  return t.exportNamedDeclaration(
    t.variableDeclaration('const', [t.variableDeclarator(t.identifier(name), t.cloneNode(initializer, true))]),
  );
}

export function collectInlineCreateSteps(
  node: t.Node,
  seenNames: Set<string>,
  statements: t.Statement[],
  onStep?: (exportName: string, call: t.CallExpression) => void,
): void {
  walk(node, current => {
    if (!isCreateStepCall(current)) {
      return;
    }

    const stepName = getStepNameFromCall(current);
    if (!stepName || seenNames.has(stepName)) {
      return false;
    }

    seenNames.add(stepName);
    onStep?.(stepName, current);
    statements.push(createExportedStepStatement(stepName, current));
    return false;
  });
}

export function getCreateStepId(node: t.Node | null | undefined): string | null {
  if (!node || !isCreateStepCall(node)) {
    return null;
  }

  const [config] = node.arguments;
  if (!t.isObjectExpression(config)) {
    return null;
  }

  for (const property of config.properties) {
    if (!t.isObjectProperty(property) && !t.isObjectMethod(property)) {
      continue;
    }

    if (getObjectPropertyName(property) !== 'id') {
      continue;
    }

    const value = t.isObjectMethod(property) ? null : property.value;
    return t.isStringLiteral(value) ? value.value : null;
  }

  return null;
}

export function shouldCountIdentifierAsReference(parent: t.Node | null, key: string | null): boolean {
  if (!parent) {
    return true;
  }

  if ((t.isObjectProperty(parent) || t.isObjectMethod(parent)) && key === 'key' && !parent.computed) {
    return false;
  }

  if (t.isMemberExpression(parent) && key === 'property' && !parent.computed) {
    return false;
  }

  if (t.isVariableDeclarator(parent) && key === 'id') {
    return false;
  }

  if (
    (t.isFunctionDeclaration(parent) || t.isFunctionExpression(parent) || t.isArrowFunctionExpression(parent)) &&
    key === 'params'
  ) {
    return false;
  }

  if (
    (t.isFunctionDeclaration(parent) || t.isFunctionExpression(parent) || t.isClassDeclaration(parent)) &&
    key === 'id'
  ) {
    return false;
  }

  if (
    (t.isImportSpecifier(parent) || t.isImportDefaultSpecifier(parent) || t.isImportNamespaceSpecifier(parent)) &&
    (key === 'local' || key === 'imported')
  ) {
    return false;
  }

  if (t.isExportSpecifier(parent) && key === 'exported') {
    return false;
  }

  if (t.isLabeledStatement(parent) && key === 'label') {
    return false;
  }

  if (t.isCatchClause(parent) && key === 'param') {
    return false;
  }

  if (t.isRestElement(parent) && key === 'argument') {
    return false;
  }

  if (t.isAssignmentPattern(parent) && key === 'left') {
    return false;
  }

  if (t.isTSPropertySignature(parent) || t.isTSMethodSignature(parent) || t.isTSExpressionWithTypeArguments(parent)) {
    return false;
  }

  return true;
}

export function collectRuntimeReferencedIdentifiers(node: t.Node): Set<string> {
  const refs = new Set<string>();

  const visit = (current: t.Node | null | undefined, parent: t.Node | null, key: string | null) => {
    if (!current) {
      return;
    }

    if (current.type.startsWith('TS')) {
      return;
    }

    if (t.isIdentifier(current)) {
      if (shouldCountIdentifierAsReference(parent, key)) {
        refs.add(current.name);
      }
      return;
    }

    for (const visitorKey of t.VISITOR_KEYS[current.type] ?? []) {
      const value = (current as unknown as Record<string, unknown>)[visitorKey];
      if (Array.isArray(value)) {
        value.forEach(child => {
          if (t.isNode(child)) {
            visit(child, current, visitorKey);
          }
        });
        continue;
      }

      if (t.isNode(value)) {
        visit(value, current, visitorKey);
      }
    }
  };

  visit(node, null, null);
  return refs;
}

export function pruneUnusedTopLevelBindings(statements: t.Statement[]): t.Statement[] {
  const bindings = new Map<string, { refs: Set<string>; statementIndex: number }>();
  const liveStatements = new Set<number>();
  const queue: number[] = [];

  const markLive = (statementIndex: number) => {
    if (liveStatements.has(statementIndex)) {
      return;
    }

    liveStatements.add(statementIndex);
    queue.push(statementIndex);
  };

  statements.forEach((statement, statementIndex) => {
    if (t.isImportDeclaration(statement)) {
      for (const specifier of statement.specifiers) {
        bindings.set(specifier.local.name, { refs: new Set(), statementIndex });
      }
      return;
    }

    if (t.isVariableDeclaration(statement)) {
      for (const declaration of statement.declarations) {
        if (t.isIdentifier(declaration.id)) {
          bindings.set(declaration.id.name, {
            refs: declaration.init ? collectRuntimeReferencedIdentifiers(declaration.init) : new Set(),
            statementIndex,
          });
        }
      }
      return;
    }

    if (t.isExportNamedDeclaration(statement) && t.isVariableDeclaration(statement.declaration)) {
      for (const declaration of statement.declaration.declarations) {
        if (t.isIdentifier(declaration.id)) {
          bindings.set(declaration.id.name, {
            refs: declaration.init ? collectRuntimeReferencedIdentifiers(declaration.init) : new Set(),
            statementIndex,
          });
        }
      }
      markLive(statementIndex);
      return;
    }

    markLive(statementIndex);
  });

  while (queue.length > 0) {
    const statementIndex = queue.pop()!;
    const statement = statements[statementIndex];
    if (!statement) {
      continue;
    }

    const refs = new Set<string>();

    if (t.isImportDeclaration(statement)) {
      continue;
    }

    if (t.isVariableDeclaration(statement)) {
      for (const declaration of statement.declarations) {
        if (declaration.init) {
          for (const ref of collectRuntimeReferencedIdentifiers(declaration.init)) {
            refs.add(ref);
          }
        }
      }
    } else if (t.isExportNamedDeclaration(statement) && t.isVariableDeclaration(statement.declaration)) {
      for (const declaration of statement.declaration.declarations) {
        if (declaration.init) {
          for (const ref of collectRuntimeReferencedIdentifiers(declaration.init)) {
            refs.add(ref);
          }
        }
      }
    } else {
      for (const ref of collectRuntimeReferencedIdentifiers(statement)) {
        refs.add(ref);
      }
    }

    for (const ref of refs) {
      const binding = bindings.get(ref);
      if (binding) {
        markLive(binding.statementIndex);
      }
    }
  }

  const prunedStatements: t.Statement[] = [];

  statements.forEach((statement, statementIndex) => {
    if (!liveStatements.has(statementIndex)) {
      return;
    }

    if (t.isImportDeclaration(statement)) {
      const specifiers = statement.specifiers.filter(specifier =>
        liveStatements.has(bindings.get(specifier.local.name)?.statementIndex ?? -1),
      );
      if (specifiers.length > 0) {
        prunedStatements.push(t.importDeclaration(specifiers, statement.source));
      }
      return;
    }

    if (t.isVariableDeclaration(statement)) {
      const declarations = statement.declarations.filter(
        declaration =>
          !t.isIdentifier(declaration.id) ||
          liveStatements.has(bindings.get(declaration.id.name)?.statementIndex ?? -1),
      );
      if (declarations.length > 0) {
        prunedStatements.push(t.variableDeclaration(statement.kind, declarations));
      }
      return;
    }

    if (t.isExportNamedDeclaration(statement) && t.isVariableDeclaration(statement.declaration)) {
      const declarations = statement.declaration.declarations.filter(
        declaration =>
          !t.isIdentifier(declaration.id) ||
          liveStatements.has(bindings.get(declaration.id.name)?.statementIndex ?? -1),
      );
      if (declarations.length > 0) {
        prunedStatements.push(
          t.exportNamedDeclaration(t.variableDeclaration(statement.declaration.kind, declarations)),
        );
      }
      return;
    }

    prunedStatements.push(statement);
  });

  return prunedStatements;
}
