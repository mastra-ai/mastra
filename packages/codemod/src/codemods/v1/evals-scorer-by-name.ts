import { createTransformer } from '../lib/create-transformer';

/**
 * Renames mastra.getScorerByName() to mastra.getScorerById().
 * This aligns with the broader API pattern of using 'id' for entity identification.
 *
 * Before:
 * const scorer = mastra.getScorerByName('helpfulness-scorer');
 *
 * After:
 * const scorer = mastra.getScorerById('helpfulness-scorer');
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const oldMethodName = 'getScorerByName';
  const newMethodName = 'getScorerById';

  // Track Mastra instances
  const mastraInstances = new Set<string>();

  // Find Mastra instances
  root
    .find(j.NewExpression, {
      callee: {
        type: 'Identifier',
        name: 'Mastra',
      },
    })
    .forEach(path => {
      const parent = path.parent.value;
      if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        mastraInstances.add(parent.id.name);
      }
    });

  // Find and rename method calls on Mastra instances
  root
    .find(j.CallExpression)
    .filter(path => {
      const { callee } = path.value;
      if (callee.type !== 'MemberExpression') return false;
      if (callee.object.type !== 'Identifier') return false;
      if (callee.property.type !== 'Identifier') return false;

      // Only process if called on a Mastra instance
      if (!mastraInstances.has(callee.object.name)) return false;

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
    context.messages.push('Renamed getScorerByName to getScorerById on Mastra instances');
  }
});
