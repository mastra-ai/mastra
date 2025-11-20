import { createTransformer } from '../lib/create-transformer';
import { trackMultipleClassInstances, renameMethod } from '../lib/utils';

/**
 * Renames storage.getMessagesById() to storage.listMessagesById().
 * This aligns with the convention that list* methods return collections.
 *
 * Before:
 * const result = await storage.getMessagesById({
 *   messageIds: ['msg-1', 'msg-2'],
 * });
 *
 * After:
 * const result = await storage.listMessagesById({
 *   messageIds: ['msg-1', 'msg-2'],
 * });
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  const storeTypes = ['PostgresStore', 'LibSQLStore', 'PgStore', 'DynamoDBStore', 'MongoDBStore', 'MSSQLStore'];

  // Track all store instances in a single optimized pass
  const storageInstances = trackMultipleClassInstances(j, root, storeTypes);
  const count = renameMethod(j, root, storageInstances, 'getMessagesById', 'listMessagesById');

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push('Renamed getMessagesById to listMessagesById on storage instances');
  }
});
