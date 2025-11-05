import { createTransformer } from '../lib/create-transformer';

/**
 * The `RuntimeContext` class has been renamed to `RequestContext`, and all parameter names have been updated from `runtimeContext` to `requestContext` across all APIs.
 */

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track whether RuntimeContext was imported from @mastra/core/runtime-context
  let hasRuntimeContextImport = false;

  // 1. Update import declarations from runtime-context to request-context
  root.find(j.ImportDeclaration).forEach(importPath => {
    const node = importPath.node;

    // Early return: Only process imports from @mastra/core/runtime-context
    if (node.source.value !== '@mastra/core/runtime-context') return;

    // Update the import path
    node.source.value = '@mastra/core/request-context';
    context.hasChanges = true;

    // Update RuntimeContext to RequestContext in import specifiers
    node.specifiers?.forEach(specifier => {
      if (specifier.type !== 'ImportSpecifier') return;

      const imported = specifier.imported;
      if (imported.type === 'Identifier' && imported.name === 'RuntimeContext') {
        hasRuntimeContextImport = true;
        imported.name = 'RequestContext';
        context.messages.push(`Updated import: RuntimeContext → RequestContext from '@mastra/core/request-context'`);
      }
    });
  });

  // Early return: Only proceed if RuntimeContext was imported from Mastra
  if (!hasRuntimeContextImport) return;

  // 2. Rename RuntimeContext type/class references
  renameIdentifiers(j, root, context, 'RuntimeContext', 'RequestContext', 'type');

  // 3. Rename runtimeContext variable/parameter identifiers
  renameIdentifiers(j, root, context, 'runtimeContext', 'requestContext', 'variable/parameter');

  // 4. Rename string literal 'runtimeContext' to 'requestContext' in Mastra middleware
  renameMiddlewareStringLiterals(j, root, context);
});

/**
 * Helper to rename all occurrences of an identifier
 */
function renameIdentifiers(j: any, root: any, context: any, oldName: string, newName: string, description: string) {
  const identifiers = root.find(j.Identifier, { name: oldName });
  const count = identifiers.length;

  if (count === 0) return;

  identifiers.forEach((path: any) => {
    path.node.name = newName;
  });

  context.hasChanges = true;
  context.messages.push(`Renamed ${count} ${oldName} ${description} references to ${newName}`);
}

/**
 * Helper to rename 'runtimeContext' string literals in Mastra middleware handlers
 */
function renameMiddlewareStringLiterals(j: any, root: any, context: any) {
  let stringLiteralCount = 0;

  // Find all new Mastra({ ... }) expressions
  root
    .find(j.NewExpression, {
      callee: { type: 'Identifier', name: 'Mastra' },
    })
    .forEach((mastraPath: any) => {
      const configArg = mastraPath.node.arguments[0];
      if (!configArg || configArg.type !== 'ObjectExpression') return;

      // Process this Mastra config to find and rename context.get() calls
      const contextParamNames = new Set<string>();
      stringLiteralCount += processNode(configArg, contextParamNames, context);
    });

  if (stringLiteralCount > 0) {
    context.messages.push(
      `Renamed ${stringLiteralCount} string literal 'runtimeContext' to 'requestContext' in Mastra server.middleware`,
    );
  }
}

/**
 * Recursively search for handler properties and rename context.get() calls
 */
function processNode(node: any, contextParamNames: Set<string>, context: any): number {
  if (!node || typeof node !== 'object') return 0;

  let count = 0;

  // Check if this is a handler property
  if (isHandlerProperty(node)) {
    const paramName = extractFirstParamName(node.value);
    if (paramName) {
      contextParamNames.add(paramName);
    }
  }

  // Check if this is a context.get('runtimeContext') call
  if (isContextGetCall(node, contextParamNames)) {
    if (renameStringLiteralArg(node, context)) {
      count++;
    }
  }

  // Recursively process all object properties
  for (const key in node) {
    if (!shouldProcessKey(key, node)) continue;

    const value = node[key];
    if (Array.isArray(value)) {
      value.forEach(item => {
        count += processNode(item, contextParamNames, context);
      });
    } else if (value && typeof value === 'object') {
      count += processNode(value, contextParamNames, context);
    }
  }

  return count;
}

/**
 * Check if a node is a handler property (Property or ObjectProperty with key 'handler')
 */
function isHandlerProperty(node: any): boolean {
  return (node.type === 'Property' || node.type === 'ObjectProperty') && node.key?.name === 'handler';
}

/**
 * Extract the first parameter name from a function expression
 */
function extractFirstParamName(handlerValue: any): string | null {
  if (
    !handlerValue ||
    (handlerValue.type !== 'ArrowFunctionExpression' && handlerValue.type !== 'FunctionExpression')
  ) {
    return null;
  }

  if (!handlerValue.params || handlerValue.params.length === 0) {
    return null;
  }

  const firstParam = handlerValue.params[0];
  if (firstParam?.type === 'Identifier') {
    return firstParam.name;
  }

  return null;
}

/**
 * Check if a node is a context.get() call expression
 */
function isContextGetCall(node: any, contextParamNames: Set<string>): boolean {
  if (node.type !== 'CallExpression') return false;

  const callee = node.callee;
  if (!callee || callee.type !== 'MemberExpression') return false;

  const object = callee.object;
  if (!object || object.type !== 'Identifier') return false;

  if (!contextParamNames.has(object.name)) return false;

  const property = callee.property;
  if (!property || property.type !== 'Identifier' || property.name !== 'get') return false;

  return true;
}

/**
 * Rename the first string argument from 'runtimeContext' to 'requestContext'
 */
function renameStringLiteralArg(node: any, context: any): boolean {
  const firstArg = node.arguments?.[0];
  if (!firstArg) return false;

  const isRuntimeContextLiteral =
    (firstArg.type === 'StringLiteral' && firstArg.value === 'runtimeContext') ||
    (firstArg.type === 'Literal' && firstArg.value === 'runtimeContext');

  if (!isRuntimeContextLiteral) return false;

  // Rename the value
  firstArg.value = 'requestContext';

  // Update the raw value if it exists
  if (firstArg.extra?.raw) {
    const quote = firstArg.extra.raw.charAt(0);
    firstArg.extra.raw = `${quote}requestContext${quote}`;
  }

  context.hasChanges = true;
  return true;
}

/**
 * Check if we should process this object key during recursion
 */
function shouldProcessKey(key: string, node: any): boolean {
  // Skip non-own properties
  if (!node.hasOwnProperty(key)) return false;

  // Skip metadata properties that don't contain code
  if (key === 'loc' || key === 'comments') return false;

  return true;
}
