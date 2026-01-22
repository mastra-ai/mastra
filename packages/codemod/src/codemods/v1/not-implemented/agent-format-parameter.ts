/* eslint-disable no-warning-comments */
import { insertCommentOnce } from '../../lib/add-comment';
import { createTransformer } from '../../lib/create-transformer';

/**
 * Adds a FIXME comment above the format parameter in agent.generate() and agent.stream() calls.
 * The format parameter has been removed in v1 and requires manual migration.
 *
 * Before:
 * agent.generate('prompt', { format: 'aisdk' })
 *
 * After:
 * agent.generate('prompt', {
 *   /* FIXME(mastra): The format parameter has been removed. See: https://mastra.ai/guides/migrations/upgrade-to-v1/agent#format-parameter-from-stream-and-generate *\/
 *   format: 'aisdk'
 * })
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const COMMENT_MESSAGE =
    'FIXME(mastra): The format parameter has been removed. See: https://mastra.ai/guides/migrations/upgrade-to-v1/agent#format-parameter-from-stream-and-generate';

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

  // Find agent.generate() and agent.stream() calls
  root
    .find(j.CallExpression)
    .filter(path => {
      const { callee } = path.value;
      if (callee.type !== 'MemberExpression') return false;
      if (callee.object.type !== 'Identifier') return false;
      if (callee.property.type !== 'Identifier') return false;

      // Only process if called on an Agent instance
      if (!agentInstances.has(callee.object.name)) return false;

      // Only process generate() and stream() methods
      return callee.property.name === 'generate' || callee.property.name === 'stream';
    })
    .forEach(path => {
      const args = path.value.arguments;

      // We're looking for calls with an options object that has format parameter
      if (args.length < 2) return;

      const optionsArg = args[1];
      if (!optionsArg || optionsArg.type !== 'ObjectExpression') return;
      if (!optionsArg.properties) return;

      // Find the format property
      optionsArg.properties.forEach(prop => {
        if (
          (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
          prop.key?.type === 'Identifier' &&
          prop.key.name === 'format'
        ) {
          // Add FIXME comment to the format property
          const added = insertCommentOnce(prop, j, COMMENT_MESSAGE);
          if (added) {
            context.hasChanges = true;
          }
        }
      });
    });

  if (context.hasChanges) {
    context.messages.push(`Not Implemented ${fileInfo.path}: The format 'aisdk' parameter has been removed.`);
  }
});
