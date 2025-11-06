import { createTransformer } from '../lib/create-transformer';

/**
 * Renames experimental_auth to auth in Mastra configuration.
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Find all new Mastra({ ... }) expressions
  root
    .find(j.NewExpression, {
      callee: { type: 'Identifier', name: 'Mastra' },
    })
    .forEach(mastraPath => {
      const configArg = mastraPath.node.arguments[0];
      if (!configArg || configArg.type !== 'ObjectExpression') return;

      // Find experimental_auth property in the Mastra config object
      configArg.properties?.forEach((prop: any) => {
        if (
          (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
          prop.key.type === 'Identifier' &&
          prop.key.name === 'experimental_auth'
        ) {
          // Rename to 'auth'
          prop.key.name = 'auth';
          context.hasChanges = true;
        }
      });
    });

  if (context.hasChanges) {
    context.messages.push(`Renamed experimental_auth to auth in Mastra configuration`);
  }
});
