import { createTransformer } from '../lib/create-transformer';

/**
 * Renames vectorMessageSearch parameter to vectorSearchString in memory.recall() calls.
 * This provides more consistent naming.
 *
 * Before:
 * memory.recall({
 *   threadId: 'thread-123',
 *   vectorMessageSearch: 'What did we discuss?',
 * });
 *
 * After:
 * memory.recall({
 *   threadId: 'thread-123',
 *   vectorSearchString: 'What did we discuss?',
 * });
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const oldParamName = 'vectorMessageSearch';
  const newParamName = 'vectorSearchString';

  const memoryInstances = new Set<string>();

  root.find(j.NewExpression, { callee: { type: 'Identifier', name: 'Memory' } }).forEach(path => {
    const parent = path.parent.value;
    if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
      memoryInstances.add(parent.id.name);
    }
  });

  root
    .find(j.CallExpression)
    .filter(path => {
      const { callee } = path.value;
      if (callee.type !== 'MemberExpression') return false;
      if (callee.object.type !== 'Identifier') return false;
      if (callee.property.type !== 'Identifier') return false;
      if (!memoryInstances.has(callee.object.name)) return false;
      return callee.property.name === 'recall';
    })
    .forEach(path => {
      const args = path.value.arguments;
      const firstArg = args[0];
      if (!firstArg || firstArg.type !== 'ObjectExpression' || !firstArg.properties) return;

      firstArg.properties.forEach(prop => {
        if (
          (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
          prop.key &&
          prop.key.type === 'Identifier' &&
          prop.key.name === oldParamName
        ) {
          prop.key.name = newParamName;
          context.hasChanges = true;
        }
      });
    });

  if (context.hasChanges) {
    context.messages.push('Renamed vectorMessageSearch to vectorSearchString in memory.recall() calls');
  }
});
