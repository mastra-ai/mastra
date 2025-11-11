import { createTransformer } from '../lib/create-transformer';

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
        callee.property.name === 'getMessagesPaginated'
      );
    })
    .forEach(path => {
      const callee = path.value.callee;
      if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
        callee.property.name = 'listMessages';
      }

      const args = path.value.arguments;
      const firstArg = args[0];
      if (firstArg && firstArg.type === 'ObjectExpression' && firstArg.properties) {
        firstArg.properties.forEach(prop => {
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
