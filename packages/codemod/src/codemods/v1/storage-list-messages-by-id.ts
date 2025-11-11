import { createTransformer } from '../lib/create-transformer';

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
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const storageInstances = new Set<string>();
  const storeTypes = ['PostgresStore', 'LibSQLStore', 'PgStore', 'DynamoDBStore', 'MongoDBStore', 'MSSQLStore'];

  storeTypes.forEach(storeType => {
    root.find(j.NewExpression, { callee: { type: 'Identifier', name: storeType } }).forEach(path => {
      const parent = path.parent.value;
      if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        storageInstances.add(parent.id.name);
      }
    });
  });

  root
    .find(j.CallExpression)
    .filter(path => {
      const { callee } = path.value;
      return (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.property.type === 'Identifier' &&
        storageInstances.has(callee.object.name) &&
        callee.property.name === 'getMessagesById'
      );
    })
    .forEach(path => {
      const callee = path.value.callee;
      if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
        callee.property.name = 'listMessagesById';
        context.hasChanges = true;
      }
    });

  if (context.hasChanges) {
    context.messages.push('Renamed getMessagesById to listMessagesById on storage instances');
  }
});
