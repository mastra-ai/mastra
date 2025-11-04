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
  }
});
