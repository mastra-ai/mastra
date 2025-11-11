import { createTransformer } from '../lib/create-transformer';

/**
 * Renames workflow.createRunAsync() to workflow.createRun().
 * This simplifies the API by removing the redundant "Async" suffix.
 *
 * Before:
 * await workflow.createRunAsync({ input: { ... } });
 *
 * After:
 * await workflow.createRun({ input: { ... } });
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const oldMethodName = 'createRunAsync';
  const newMethodName = 'createRun';

  // Track Workflow instances
  const workflowInstances = new Set<string>();

  // Find Workflow instances
  root
    .find(j.NewExpression, {
      callee: {
        type: 'Identifier',
        name: 'Workflow',
      },
    })
    .forEach(path => {
      const parent = path.parent.value;
      if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        workflowInstances.add(parent.id.name);
      }
    });

  // Find and rename method calls on Workflow instances
  root
    .find(j.CallExpression)
    .filter(path => {
      const { callee } = path.value;
      if (callee.type !== 'MemberExpression') return false;
      if (callee.object.type !== 'Identifier') return false;
      if (callee.property.type !== 'Identifier') return false;

      // Only process if called on a Workflow instance
      if (!workflowInstances.has(callee.object.name)) return false;

      // Only process if it's the method we want to rename
      return callee.property.name === oldMethodName;
    })
    .forEach(path => {
      const callee = path.value.callee as any;
      callee.property.name = newMethodName;
      context.hasChanges = true;
    });

  if (context.hasChanges) {
    context.messages.push('Renamed createRunAsync to createRun on Workflow instances');
  }
});
