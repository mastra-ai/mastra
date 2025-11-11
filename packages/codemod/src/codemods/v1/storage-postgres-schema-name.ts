import { createTransformer } from '../lib/create-transformer';

/**
 * Renames schema parameter to schemaName in PostgresStore constructor.
 * This provides clearer naming to avoid confusion with database schema concepts.
 *
 * Before:
 * const pgStore = new PostgresStore({
 *   connectionString: process.env.POSTGRES_CONNECTION_STRING,
 *   schema: customSchema,
 * });
 *
 * After:
 * const pgStore = new PostgresStore({
 *   connectionString: process.env.POSTGRES_CONNECTION_STRING,
 *   schemaName: customSchema,
 * });
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  root
    .find(j.NewExpression, {
      callee: { type: 'Identifier', name: 'PostgresStore' },
    })
    .forEach(path => {
      const args = path.value.arguments;
      const firstArg = args[0];
      if (!firstArg || firstArg.type !== 'ObjectExpression' || !firstArg.properties) return;

      firstArg.properties.forEach(prop => {
        if (
          (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
          prop.key &&
          prop.key.type === 'Identifier' &&
          prop.key.name === 'schema'
        ) {
          prop.key.name = 'schemaName';
          context.hasChanges = true;
        }
      });
    });

  if (context.hasChanges) {
    context.messages.push('Renamed schema to schemaName in PostgresStore constructor');
  }
});
