import { createTransformer } from '../lib/create-transformer';

/**
 * Renames toAISdkFormat to toAISdkStream in imports and usages.
 * This aligns the function name with its actual behavior.
 *
 * Before:
 * import { toAISdkFormat } from '@mastra/ai-sdk';
 * const stream = toAISdkFormat(agentStream);
 *
 * After:
 * import { toAISdkStream } from '@mastra/ai-sdk';
 * const stream = toAISdkStream(agentStream);
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const oldName = 'toAISdkFormat';
  const newName = 'toAISdkStream';

  // Track if toAISdkFormat was imported from @mastra/ai-sdk
  let wasImported = false;

  // Transform import specifiers
  root
    .find(j.ImportDeclaration)
    .filter(path => {
      const source = path.value.source.value;
      return typeof source === 'string' && source === '@mastra/ai-sdk';
    })
    .forEach(path => {
      path.value.specifiers?.forEach((specifier: any) => {
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          specifier.imported.name === oldName
        ) {
          wasImported = true;
          specifier.imported.name = newName;

          // Also update the local name if it matches the imported name
          if (specifier.local && specifier.local.name === oldName) {
            specifier.local.name = newName;
          }

          context.hasChanges = true;
        }
      });
    });

  // Only transform usages if it was imported from @mastra/ai-sdk
  if (wasImported) {
    // Transform all references to the old name
    root.find(j.Identifier, { name: oldName }).forEach(path => {
      path.value.name = newName;
      context.hasChanges = true;
    });
  }

  if (context.hasChanges) {
    context.messages.push('Renamed toAISdkFormat to toAISdkStream');
  }
});
