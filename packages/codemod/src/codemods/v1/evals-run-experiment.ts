import { createTransformer } from '../lib/create-transformer';

/**
 * Renames runExperiment to runEvals in imports and usages.
 * This provides clearer naming that better describes the evaluation functionality.
 *
 * Before:
 * import { runExperiment } from '@mastra/core/evals';
 * const result = await runExperiment({ target, scorers, data });
 *
 * After:
 * import { runEvals } from '@mastra/core/evals';
 * const result = await runEvals({ target, scorers, data });
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const oldName = 'runExperiment';
  const newName = 'runEvals';

  // Track the local name that was imported from @mastra/core/evals
  let localNameToReplace: string | null = null;

  // First pass: Transform import specifiers from @mastra/core/evals
  root
    .find(j.ImportDeclaration)
    .filter(path => {
      const source = path.value.source.value;
      return typeof source === 'string' && source === '@mastra/core/evals';
    })
    .forEach(path => {
      path.value.specifiers?.forEach(specifier => {
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          specifier.imported.name === oldName
        ) {
          // Track the local name BEFORE we rename it (could be aliased)
          localNameToReplace = typeof specifier.local?.name === 'string' ? specifier.local.name : oldName;

          // Rename the imported name
          specifier.imported.name = newName;

          // Also update the local name if it matches the imported name (not aliased)
          if (specifier.local && specifier.local.name === oldName) {
            specifier.local.name = newName;
          }

          context.hasChanges = true;
        }
      });
    });

  // Second pass: Only transform usages if it was imported from @mastra/core/evals
  if (localNameToReplace) {
    // Transform all references to the local name, excluding those in import declarations
    root.find(j.Identifier, { name: localNameToReplace }).forEach(path => {
      // Skip identifiers that are part of import declarations
      const parent = path.parent;
      if (parent && parent.value.type === 'ImportSpecifier') {
        return;
      }

      path.value.name = newName;
      context.hasChanges = true;
    });
  }

  if (context.hasChanges) {
    context.messages.push('Renamed runExperiment to runEvals');
  }
});
