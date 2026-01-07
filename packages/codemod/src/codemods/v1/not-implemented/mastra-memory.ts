/* eslint-disable no-warning-comments */
import { insertCommentOnce } from '../../lib/add-comment';
import { createTransformer } from '../../lib/create-transformer';

/**
 * Adds FIXME comment when Mastra config includes a memory property.
 * The memory property has been removed from Mastra class and should be configured at the agent level.
 *
 * Before:
 * const mastra = new Mastra({ memory: new Memory() });
 *
 * After:
 * /* FIXME(mastra): `memory` property has been removed. Memory is configured at the agent level. See: ... *\/
 * const mastra = new Mastra({ memory: new Memory() });
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const COMMENT_MESSAGE =
    'FIXME(mastra): `memory` property has been removed. Memory is configured at the agent level. See: https://mastra.ai/guides/migrations/upgrade-to-v1/mastra#memory-property-from-mastra-class';

  // Find new Mastra() expressions
  root
    .find(j.NewExpression, {
      callee: {
        type: 'Identifier',
        name: 'Mastra',
      },
    })
    .forEach(path => {
      // Check if config has a memory property
      const hasMemory = path.value.arguments.some(arg => {
        if (arg.type === 'ObjectExpression') {
          return arg.properties?.some(
            prop =>
              (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
              prop.key?.type === 'Identifier' &&
              prop.key.name === 'memory',
          );
        }
        return false;
      });

      if (hasMemory) {
        // Find the parent statement to add comment
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

          const added = insertCommentOnce(targetNode, j, COMMENT_MESSAGE);
          if (added) {
            context.hasChanges = true;
          }
        }
      }
    });

  if (context.hasChanges) {
    context.messages.push(`Not Implemented ${fileInfo.path}: The memory property has been removed.`);
  }
});
