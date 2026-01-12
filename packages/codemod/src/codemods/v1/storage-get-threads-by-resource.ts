import { createTransformer } from '../lib/create-transformer';
import { trackMultipleClassInstances, renameMethod } from '../lib/utils';

/**
 * Renames storage.getThreadsByResourceId() to storage.listThreadsByResourceId().
 * This aligns with the convention that list* methods return collections.
 *
 * Before:
 * const threads = await storage.getThreadsByResourceId({ resourceId: 'res-123' });
 *
 * After:
 * const threads = await storage.listThreads({ filter: { resourceId: 'res-123'  }});
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  const storeTypes = ['PostgresStore', 'LibSQLStore', 'PgStore', 'DynamoDBStore', 'MongoDBStore', 'MSSQLStore'];

  // Track all store instances in a single optimized pass
  const storageInstances = trackMultipleClassInstances(j, root, storeTypes);
  const count = renameMethod(j, root, storageInstances, 'getThreadsByResourceId', 'listThreadsByResourceId');

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push('Renamed getThreadsByResourceId to listThreadsByResourceId on storage instances');
  }
});
