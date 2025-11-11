import { createTransformer } from '../lib/create-transformer';

/**
 * Renames memory.query() to memory.recall().
 * This better describes the action of retrieving messages from memory.
 *
 * Before:
 * const result = await memory.query({ threadId: 'thread-123' });
 *
 * After:
 * const result = await memory.recall({ threadId: 'thread-123' });
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const oldMethodName = 'query';
  const newMethodName = 'recall';

  // Track Memory instances
  const memoryInstances = new Set<string>();

  // Find Memory instances
  root
    .find(j.NewExpression, {
      callee: {
        type: 'Identifier',
        name: 'Memory',
      },
    })
    .forEach(path => {
      const parent = path.parent.value;
      if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        memoryInstances.add(parent.id.name);
      }
    });

  // Find and rename method calls on Memory instances
  root
    .find(j.CallExpression)
    .filter(path => {
      const { callee } = path.value;
      if (callee.type !== 'MemberExpression') return false;
      if (callee.object.type !== 'Identifier') return false;
      if (callee.property.type !== 'Identifier') return false;

      // Only process if called on a Memory instance
      if (!memoryInstances.has(callee.object.name)) return false;

      // Only process if it's the method we want to rename
      return callee.property.name === oldMethodName;
    })
    .forEach(path => {
      const callee = path.value.callee as any;
      callee.property.name = newMethodName;
      context.hasChanges = true;
    });

  if (context.hasChanges) {
    context.messages.push('Renamed query to recall on Memory instances');
  }
});
