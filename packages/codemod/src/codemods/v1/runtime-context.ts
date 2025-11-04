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

    // Only process imports from @mastra/core/runtime-context
    if (node.source.value !== '@mastra/core/runtime-context') return;

    // Update the import path
    node.source.value = '@mastra/core/request-context';
    context.hasChanges = true;

    // Update RuntimeContext to RequestContext in import specifiers
    node.specifiers?.forEach(specifier => {
      if (specifier.type === 'ImportSpecifier') {
        const imported = specifier.imported;
        if (imported.type === 'Identifier' && imported.name === 'RuntimeContext') {
          hasRuntimeContextImport = true;
          imported.name = 'RequestContext';
          context.messages.push(`Updated import: RuntimeContext → RequestContext from '@mastra/core/request-context'`);
        }
      }
    });
  });

  // 2. Only rename RuntimeContext type/class references if it was imported from Mastra
  if (hasRuntimeContextImport) {
    const runtimeContextCount = root.find(j.Identifier, { name: 'RuntimeContext' }).length;
    if (runtimeContextCount > 0) {
      root.find(j.Identifier, { name: 'RuntimeContext' }).forEach(path => {
        path.node.name = 'RequestContext';
      });
      context.hasChanges = true;
      context.messages.push(`Renamed ${runtimeContextCount} RuntimeContext type references to RequestContext`);
    }

    // 3. Only rename runtimeContext variable/parameter identifiers if RuntimeContext was imported from Mastra
    const runtimeContextVarCount = root.find(j.Identifier, { name: 'runtimeContext' }).length;
    if (runtimeContextVarCount > 0) {
      root.find(j.Identifier, { name: 'runtimeContext' }).forEach(path => {
        path.node.name = 'requestContext';
      });
      context.hasChanges = true;
      context.messages.push(
        `Renamed ${runtimeContextVarCount} runtimeContext variable/parameter references to requestContext`,
      );
    }

    // 4. Rename string literal 'runtimeContext' to 'requestContext' in context.get() calls within Mastra config
    let stringLiteralCount = 0;

    // Helper function to recursively search for handler properties and rename context.get() calls
    function processNode(node: any, contextParamNames: Set<string>) {
      if (!node || typeof node !== 'object') return;

      // If this is a handler property, extract the first parameter name
      if ((node.type === 'Property' || node.type === 'ObjectProperty') && node.key?.name === 'handler') {
        const handlerValue = node.value;
        if (
          (handlerValue.type === 'ArrowFunctionExpression' || handlerValue.type === 'FunctionExpression') &&
          handlerValue.params &&
          handlerValue.params.length > 0
        ) {
          const firstParam = handlerValue.params[0];
          if (firstParam && firstParam.type === 'Identifier') {
            contextParamNames.add(firstParam.name);
          }
        }
      }

      // If this is a call expression to context.get('runtimeContext')
      if (node.type === 'CallExpression') {
        const callee = node.callee;
        if (
          callee &&
          callee.type === 'MemberExpression' &&
          callee.object &&
          callee.object.type === 'Identifier' &&
          contextParamNames.has(callee.object.name) &&
          callee.property &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'get'
        ) {
          const firstArg = node.arguments?.[0];
          if (
            firstArg &&
            ((firstArg.type === 'StringLiteral' && firstArg.value === 'runtimeContext') ||
              (firstArg.type === 'Literal' && firstArg.value === 'runtimeContext'))
          ) {
            firstArg.value = 'requestContext';
            // Update the raw value if it exists
            if (firstArg.extra?.raw) {
              const quote = firstArg.extra.raw.charAt(0);
              firstArg.extra.raw = `${quote}requestContext${quote}`;
            }
            stringLiteralCount++;
            context.hasChanges = true;
          }
        }
      }

      // Recursively process all object properties
      for (const key in node) {
        if (node.hasOwnProperty(key) && key !== 'loc' && key !== 'comments') {
          const value = node[key];
          if (Array.isArray(value)) {
            value.forEach(item => processNode(item, contextParamNames));
          } else if (value && typeof value === 'object') {
            processNode(value, contextParamNames);
          }
        }
      }
    }

    // Find all new Mastra({ ... }) expressions
    root
      .find(j.NewExpression, {
        callee: { type: 'Identifier', name: 'Mastra' },
      })
      .forEach(mastraPath => {
        const configArg = mastraPath.node.arguments[0];
        if (!configArg || configArg.type !== 'ObjectExpression') return;

        // Process this Mastra config to find and rename context.get() calls
        const contextParamNames = new Set<string>();
        processNode(configArg, contextParamNames);
      });

    if (stringLiteralCount > 0) {
      context.messages.push(
        `Renamed ${stringLiteralCount} string literal 'runtimeContext' to 'requestContext' in Mastra server.middleware`,
      );
    }
  }
});
