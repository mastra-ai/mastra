import { createTransformer } from '../lib/create-transformer';

/**
 * Renames MastraMessageV2 type to MastraDBMessage.
 * This better describes the purpose as the database message format.
 *
 * Before:
 * import { MastraMessageV2 } from '@mastra/core';
 * function processMessage(message: MastraMessageV2) {}
 *
 * After:
 * import { MastraDBMessage } from '@mastra/core';
 * function processMessage(message: MastraDBMessage) {}
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const oldTypeName = 'MastraMessageV2';
  const newTypeName = 'MastraDBMessage';

  // Track which local names were imported from @mastra/core
  const importedLocalNames = new Set<string>();

  // Transform import specifiers from @mastra/core
  root
    .find(j.ImportDeclaration)
    .filter(path => {
      const source = path.value.source.value;
      return typeof source === 'string' && source === '@mastra/core';
    })
    .forEach(path => {
      path.value.specifiers?.forEach((specifier: any) => {
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          specifier.imported.name === oldTypeName
        ) {
          // Track the local name (could be aliased)
          const localName = specifier.local?.name || oldTypeName;
          importedLocalNames.add(localName);

          // Rename the imported name
          specifier.imported.name = newTypeName;

          // Also update the local name if it matches the imported name (not aliased)
          if (specifier.local && specifier.local.name === oldTypeName) {
            specifier.local.name = newTypeName;
          }

          context.hasChanges = true;
        }
      });
    });

  // Only transform usages if it was imported from @mastra/core
  if (importedLocalNames.size > 0) {
    // Transform all references to the imported types
    importedLocalNames.forEach(localName => {
      root.find(j.Identifier, { name: localName }).forEach(path => {
        // Skip identifiers that are part of import declarations
        const parent = path.parent;
        if (parent && parent.value.type === 'ImportSpecifier') {
          return;
        }

        path.value.name = newTypeName;
        context.hasChanges = true;
      });
    });
  }

  if (context.hasChanges) {
    context.messages.push('Renamed MastraMessageV2 type to MastraDBMessage');
  }
});
