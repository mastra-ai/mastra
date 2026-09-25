import { createTransformer } from '../lib/create-transformer';

/**
 * Renames MastraMessageV2 type to MastraDBMessage.
 * This better describes the purpose as the database message format.
 *
 * Before:
 * import { MastraMessageV2 } from '@mastra/core';
 * function processMessage(message: MastraMessageV2) {}
 *
 * After the v1 migration:
 * import { MastraDBMessage } from '@mastra/core/agent';
 * function processMessage(message: MastraDBMessage) {}
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  const oldTypeName = 'MastraMessageV2';
  const newTypeName = 'MastraDBMessage';
  const supportedImportSources = new Set(['@mastra/core', '@mastra/core/agent', '@mastra/core/memory']);

  // Track which local names should be rewritten (only non-aliased imports)
  const localNamesToRewrite = new Set<string>();

  // Transform imports from every legacy subpath that exported MastraMessageV2
  root
    .find(j.ImportDeclaration)
    .filter(path => {
      const source = path.value.source.value;
      return typeof source === 'string' && supportedImportSources.has(source);
    })
    .forEach(path => {
      if (!path.value.specifiers) return;

      path.value.specifiers.forEach((specifier: any) => {
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          specifier.imported.name === oldTypeName
        ) {
          const localName = specifier.local?.name || oldTypeName;
          const isAliased = localName !== oldTypeName;

          // Rename the imported name
          specifier.imported.name = newTypeName;

          // Only update local name and track for rewriting if not aliased
          if (!isAliased) {
            if (specifier.local) {
              specifier.local.name = newTypeName;
            }
            // Track the old local name (oldTypeName) to rewrite all its usages
            localNamesToRewrite.add(oldTypeName);
          }
          // If aliased, leave the local name intact and don't track for rewriting

          context.hasChanges = true;
        }
      });
    });

  // Only transform usages for non-aliased imports
  if (localNamesToRewrite.size > 0) {
    // Transform all references that need to be rewritten
    localNamesToRewrite.forEach(oldLocalName => {
      root.find(j.Identifier, { name: oldLocalName }).forEach(path => {
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
