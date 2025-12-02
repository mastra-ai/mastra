import { createTransformer } from '../lib/create-transformer';

/**
 * Renames Client SDK types from Get* to List* pattern.
 * This aligns type names with the method naming convention.
 *
 * Before:
 * import type { GetWorkflowRunsParams, GetMemoryThreadParams } from '@mastra/client-js';
 *
 * After:
 * import type { ListWorkflowRunsParams, ListMemoryThreadsParams } from '@mastra/client-js';
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Map of old type names to new type names
  const typeRenames: Record<string, string> = {
    GetWorkflowRunsParams: 'ListWorkflowRunsParams',
    GetWorkflowRunsResponse: 'ListWorkflowRunsResponse',
    GetMemoryThreadParams: 'ListMemoryThreadsParams',
  };

  // Track which types were actually imported from @mastra/client-js
  const importedTypes = new Set<string>();

  // Transform import specifiers and track what was imported
  root
    .find(j.ImportDeclaration)
    .filter(path => {
      const source = path.value.source.value;
      return typeof source === 'string' && source === '@mastra/client-js';
    })
    .forEach(path => {
      path.value.specifiers?.forEach(specifier => {
        if (specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier') {
          const oldName = specifier.imported.name;
          const newName = typeRenames[oldName];

          if (newName) {
            // Track the local name that was imported (could be aliased)
            const localName = typeof specifier.local?.name === 'string' ? specifier.local.name : oldName;
            importedTypes.add(localName);

            specifier.imported.name = newName;
            // Also update the local name if it matches the imported name
            if (specifier.local && specifier.local.name === oldName) {
              specifier.local.name = newName;
            }
            context.hasChanges = true;
          }
        }
      });
    });

  // Only transform type references if they were imported from @mastra/client-js
  if (importedTypes.size > 0) {
    root.find(j.Identifier).forEach(path => {
      const name = path.value.name;

      // Only transform if this identifier was imported from @mastra/client-js
      if (importedTypes.has(name)) {
        const newName = typeRenames[name];

        if (newName) {
          // Check if this identifier is a type reference (not a variable declaration)
          const parent = path.parent.value;

          // Only rename if it's used as a type reference, not a variable name
          if (parent.type === 'TSTypeReference' || parent.type === 'TSTypeAnnotation') {
            path.value.name = newName;
            context.hasChanges = true;
          }
        }
      }
    });
  }

  if (context.hasChanges) {
    context.messages.push('Renamed Client SDK types from Get* to List* pattern');
  }
});
