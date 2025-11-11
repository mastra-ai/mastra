import { createTransformer } from '../lib/create-transformer';

/**
 * Renames storage.getThreadsByResourceId() to storage.listThreadsByResourceId().
 * This aligns with the convention that list* methods return collections.
 *
 * Before:
 * const threads = await storage.getThreadsByResourceId({ resourceId: 'res-123' });
 *
 * After:
 * const threads = await storage.listThreadsByResourceId({ resourceId: 'res-123' });
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const oldMethodName = 'getThreadsByResourceId';
  const newMethodName = 'listThreadsByResourceId';

  // Track storage instances (PostgresStore, LibSQLStore, etc.)
  const storageInstances = new Set<string>();

  // Find storage instances - look for various store types
  const storeTypes = ['PostgresStore', 'LibSQLStore', 'PgStore', 'DynamoDBStore', 'MongoDBStore', 'MSSQLStore'];

  storeTypes.forEach(storeType => {
    root
      .find(j.NewExpression, {
        callee: {
          type: 'Identifier',
          name: storeType,
        },
      })
      .forEach(path => {
        const parent = path.parent.value;
        if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
          storageInstances.add(parent.id.name);
        }
      });
  });

  // Find and rename method calls on storage instances
  root
    .find(j.CallExpression)
    .filter(path => {
      const { callee } = path.value;
      if (callee.type !== 'MemberExpression') return false;
      if (callee.object.type !== 'Identifier') return false;
      if (callee.property.type !== 'Identifier') return false;

      // Only process if called on a storage instance
      if (!storageInstances.has(callee.object.name)) return false;

      // Only process if it's the method we want to rename
      return callee.property.name === oldMethodName;
    })
    .forEach(path => {
      const callee = path.value.callee;
      if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
        callee.property.name = newMethodName;
        context.hasChanges = true;
      }
    });

  if (context.hasChanges) {
    context.messages.push('Renamed getThreadsByResourceId to listThreadsByResourceId on storage instances');
  }
});
