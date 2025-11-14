import { createTransformer } from '../lib/create-transformer';
import { trackMultipleClassInstances } from '../lib/utils';

/**
 * Renames storage.getMessagesPaginated() to storage.listMessages() and updates pagination parameters.
 * Changes offset/limit to page/perPage for more intuitive pagination.
 *
 * Before:
 * await storage.getMessagesPaginated({
 *   threadId: 'thread-123',
 *   offset: 0,
 *   limit: 20,
 * });
 *
 * After:
 * await storage.listMessages({
 *   threadId: 'thread-123',
 *   page: 0,
 *   perPage: 20,
 * });
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  const storeTypes = ['PostgresStore', 'LibSQLStore', 'PgStore', 'DynamoDBStore', 'MongoDBStore', 'MSSQLStore'];

  // Track all store instances in a single optimized pass
  const storageInstances = trackMultipleClassInstances(j, root, storeTypes);

  if (storageInstances.size === 0) return;

  // Single pass: rename method and transform properties
  root.find(j.CallExpression).forEach(path => {
    const { callee } = path.value;
    if (callee.type !== 'MemberExpression') return;
    if (callee.object.type !== 'Identifier') return;
    if (callee.property.type !== 'Identifier') return;
    if (!storageInstances.has(callee.object.name)) return;
    if (callee.property.name !== 'getMessagesPaginated') return;

    // Rename method
    callee.property.name = 'listMessages';

    // Transform offset/limit to page/perPage
    const args = path.value.arguments;
    const firstArg = args[0];
    if (firstArg && firstArg.type === 'ObjectExpression' && firstArg.properties) {
      firstArg.properties.forEach((prop: any) => {
        if (
          (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
          prop.key &&
          prop.key.type === 'Identifier'
        ) {
          if (prop.key.name === 'offset') prop.key.name = 'page';
          if (prop.key.name === 'limit') prop.key.name = 'perPage';
        }
      });
    }

    context.hasChanges = true;
  });

  if (context.hasChanges) {
    context.messages.push('Renamed getMessagesPaginated to listMessages and offset/limit to page/perPage');
  }
});
