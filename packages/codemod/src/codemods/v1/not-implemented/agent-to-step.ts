/* eslint-disable no-warning-comments */
import { insertCommentOnce } from '../../lib/add-comment';
import { createTransformer } from '../../lib/create-transformer';

/**
 * Adds a FIXME comment above agent.toStep() method calls.
 * The toStep() method has been removed in v1 and requires manual migration.
 *
 * Before:
 * const step = agent.toStep();
 *
 * After:
 * /* FIXME(mastra): The toStep() method has been removed. See: https://mastra.ai/guides/migrations/upgrade-to-v1/agent#agenttostep-method *\/
 * const step = agent.toStep();
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const COMMENT_MESSAGE =
    'FIXME(mastra): The toStep() method has been removed. See: https://mastra.ai/guides/migrations/upgrade-to-v1/agent#agenttostep-method';

  // Track Agent instances
  const agentInstances = new Set<string>();

  root
    .find(j.NewExpression, {
      callee: {
        type: 'Identifier',
        name: 'Agent',
      },
    })
    .forEach(path => {
      const parent = path.parent.value;
      if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        agentInstances.add(parent.id.name);
      }
    });

  // Find agent.toStep() calls
  root
    .find(j.CallExpression)
    .filter(path => {
      const { callee } = path.value;
      if (callee.type !== 'MemberExpression') return false;
      if (callee.object.type !== 'Identifier') return false;
      if (callee.property.type !== 'Identifier') return false;

      // Only process if called on an Agent instance
      if (!agentInstances.has(callee.object.name)) return false;

      // Only process toStep() method
      return callee.property.name === 'toStep';
    })
    .forEach(path => {
      // Find the parent statement to add the comment to
      let parent = path.parent;
      while (parent && parent.value.type !== 'VariableDeclaration' && parent.value.type !== 'ExpressionStatement') {
        parent = parent.parent;
      }

      if (parent && parent.value) {
        // Check if this statement is wrapped in an export declaration
        let targetNode = parent.value;
        if (parent.parent && parent.parent.value.type === 'ExportNamedDeclaration') {
          targetNode = parent.parent.value;
        }

        // Add FIXME comment to the statement (or export if it's exported)
        const added = insertCommentOnce(targetNode, j, COMMENT_MESSAGE);
        if (added) {
          context.hasChanges = true;
        }
      }
    });

  if (context.hasChanges) {
    context.messages.push(`Not Implemented ${fileInfo.path}: The toStep() method has been removed.`);
  }
});
