import { createTransformer } from '../lib/create-transformer';
import { trackMultipleClassInstances, transformMethodCalls } from '../lib/utils';

/**
 * Migrates storage.getThreadsByResourceId() to storage.listThreads() with filter wrapping.
 *
 * Before:
 * const threads = await storage.getThreadsByResourceId({ resourceId: 'res-123' });
 *
 * After:
 * const threads = await storage.listThreads({ filter: { resourceId: 'res-123' }});
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  const storeTypes = ['PostgresStore', 'LibSQLStore', 'PgStore', 'DynamoDBStore', 'MongoDBStore', 'MSSQLStore'];

  // Track all store instances in a single optimized pass
  const storageInstances = trackMultipleClassInstances(j, root, storeTypes);

  const count = transformMethodCalls(j, root, storageInstances, 'getThreadsByResourceId', path => {
    // Rename method to listThreads
    if (path.value.callee.type === 'MemberExpression' && path.value.callee.property.type === 'Identifier') {
      path.value.callee.property.name = 'listThreads';
    }

    // Wrap resourceId in filter object
    const args = path.value.arguments;
    if (args.length === 1 && args[0].type === 'ObjectExpression') {
      const objArg = args[0];
      const properties = objArg.properties;

      // Find the resourceId property
      let resourceIdProp: any = null;
      const otherProps: any[] = [];

      properties.forEach((prop: any) => {
        if (
          (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
          prop.key?.type === 'Identifier' &&
          prop.key.name === 'resourceId'
        ) {
          resourceIdProp = prop;
        } else {
          otherProps.push(prop);
        }
      });

      if (resourceIdProp && resourceIdProp.value) {
        // Create the new filter object
        const filterProp = j.property('init', j.identifier('filter'), j.objectExpression([resourceIdProp]));

        // Update arguments with filter first, then other props
        path.value.arguments = [j.objectExpression([filterProp, ...otherProps])];
      }
    }
  });

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push(
      `Migrated ${count} getThreadsByResourceId call(s) to listThreads with filter wrapping on storage instances`,
    );
  }
});
