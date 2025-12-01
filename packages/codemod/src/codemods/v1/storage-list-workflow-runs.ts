import { createTransformer } from '../lib/create-transformer';
import { trackMultipleClassInstances, renameMethod } from '../lib/utils';

/**
 * Renames storage.getWorkflowRuns() to storage.listWorkflowRuns().
 * This aligns with the convention that list* methods return collections.
 *
 * Before:
 * const runs = await storage.getWorkflowRuns({ fromDate, toDate });
 *
 * After:
 * const runs = await storage.listWorkflowRuns({ fromDate, toDate });
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  const storeTypes = ['PostgresStore', 'LibSQLStore', 'PgStore', 'DynamoDBStore', 'MongoDBStore', 'MSSQLStore'];

  // Track all store instances in a single optimized pass
  const storageInstances = trackMultipleClassInstances(j, root, storeTypes);
  const count = renameMethod(j, root, storageInstances, 'getWorkflowRuns', 'listWorkflowRuns');

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push('Renamed getWorkflowRuns to listWorkflowRuns on storage instances');
  }
});
