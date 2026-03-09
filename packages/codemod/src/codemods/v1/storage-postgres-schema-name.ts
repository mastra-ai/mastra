import { createTransformer } from '../lib/create-transformer';
import { transformConstructorProperties } from '../lib/utils';

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
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  const count = transformConstructorProperties(j, root, 'PostgresStore', { schema: 'schemaName' });

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push('Renamed schema to schemaName in PostgresStore constructor');
  }
});
