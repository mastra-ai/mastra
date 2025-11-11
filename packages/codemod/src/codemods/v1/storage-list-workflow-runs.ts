import { createTransformer } from '../lib/create-transformer';

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
        callee.property.name === 'getWorkflowRuns'
      );
    })
    .forEach(path => {
      (path.value.callee as any).property.name = 'listWorkflowRuns';
      context.hasChanges = true;
    });

  if (context.hasChanges) {
    context.messages.push('Renamed getWorkflowRuns to listWorkflowRuns on storage instances');
  }
});
