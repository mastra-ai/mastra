/* eslint-disable no-warning-comments */
import { insertCommentOnce } from '../../lib/add-comment';
import { createTransformer } from '../../lib/create-transformer';

/**
 * Adds FIXME comments to Mastra primitives that now require an `id` parameter.
 * This includes storages, vector stores, agents, workflows, tools, scorers, and MCP servers.
 *
 * Before:
 * const agent = new Agent({ name: 'Support Agent' });
 * const tool = createTool({ description: 'Get weather' });
 *
 * After:
 * /* FIXME(mastra): Add a unique `id` parameter. See: ... *\/
 * const agent = new Agent({ name: 'Support Agent' });
 * /* FIXME(mastra): Add a unique `id` parameter. See: ... *\/
 * const tool = createTool({ description: 'Get weather' });
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const COMMENT_MESSAGE =
    'FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives';

  // List of class names that require id
  const storageClasses = [
    'LibSQLStore',
    'PostgresStore',
    'D1Store',
    'MongoDBStore',
    'DynamoDBStore',
    'LibSQLVector',
    'PgVector',
    'ChromaVector',
    'PineconeVector',
    'QdrantVector',
    'LanceVector',
    'Agent',
    'MCPServer',
  ];

  // List of function names that require id
  const createFunctions = ['createWorkflow', 'createTool', 'createScorer'];

  // Find NewExpression for classes
  root.find(j.NewExpression).forEach(path => {
    if (path.value.callee.type === 'Identifier') {
      const className = path.value.callee.name;

      if (storageClasses.includes(className)) {
        // Check if the config already has an id property
        const hasId = path.value.arguments.some(arg => {
          if (arg.type === 'ObjectExpression') {
            return arg.properties?.some(
              prop =>
                (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
                prop.key?.type === 'Identifier' &&
                prop.key.name === 'id',
            );
          }
          return false;
        });

        if (!hasId) {
          // Check if the NewExpression is nested inside an object property (e.g., storage: new LibSQLStore({}))
          // or inside an array (e.g., tools: [new Agent({})])
          // In these cases, add the comment to the appropriate node
          let parent = path.parent;

          // If the direct parent is an object property, add comment to that property
          if (parent && parent.value && (parent.value.type === 'Property' || parent.value.type === 'ObjectProperty')) {
            const added = insertCommentOnce(parent.value, j, COMMENT_MESSAGE);
            if (added) {
              context.hasChanges = true;
            }
          } else if (parent && parent.value && parent.value.type === 'ArrayExpression') {
            // If the parent is an array, add comment directly to the expression
            const added = insertCommentOnce(path.value, j, COMMENT_MESSAGE);
            if (added) {
              context.hasChanges = true;
            }
          } else {
            // Find the parent statement to add comment
            const statementTypes = new Set([
              'VariableDeclaration',
              'ExpressionStatement',
              'ReturnStatement',
              'ExportDefaultDeclaration',
              'ExportNamedDeclaration',
              'Program',
            ]);

            while (parent && !statementTypes.has(parent.value.type)) {
              parent = parent.parent;
            }

            if (parent && parent.value) {
              // For export declarations, add comment to the export itself
              let targetNode = parent.value;
              if (
                targetNode.type !== 'ExportDefaultDeclaration' &&
                targetNode.type !== 'ExportNamedDeclaration' &&
                parent.parent &&
                (parent.parent.value.type === 'ExportDefaultDeclaration' ||
                  parent.parent.value.type === 'ExportNamedDeclaration')
              ) {
                targetNode = parent.parent.value;
              }

              const added = insertCommentOnce(targetNode, j, COMMENT_MESSAGE);
              if (added) {
                context.hasChanges = true;
              }
            }
          }
        }
      }
    }
  });

  // Find CallExpression for create functions
  root.find(j.CallExpression).forEach(path => {
    if (path.value.callee.type === 'Identifier') {
      const functionName = path.value.callee.name;

      if (createFunctions.includes(functionName)) {
        // Check if the config already has an id property
        const hasId = path.value.arguments.some(arg => {
          if (arg.type === 'ObjectExpression') {
            return arg.properties?.some(
              prop =>
                (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
                prop.key?.type === 'Identifier' &&
                prop.key.name === 'id',
            );
          }
          return false;
        });

        if (!hasId) {
          // Check if the CallExpression is nested inside an object property or array
          let parent = path.parent;

          // If the direct parent is an object property, add comment to that property
          if (parent && parent.value && (parent.value.type === 'Property' || parent.value.type === 'ObjectProperty')) {
            const added = insertCommentOnce(parent.value, j, COMMENT_MESSAGE);
            if (added) {
              context.hasChanges = true;
            }
          } else if (parent && parent.value && parent.value.type === 'ArrayExpression') {
            // If the parent is an array, add comment directly to the expression
            const added = insertCommentOnce(path.value, j, COMMENT_MESSAGE);
            if (added) {
              context.hasChanges = true;
            }
          } else {
            // Find the parent statement to add comment
            const statementTypes = new Set([
              'VariableDeclaration',
              'ExpressionStatement',
              'ReturnStatement',
              'ExportDefaultDeclaration',
              'ExportNamedDeclaration',
              'Program',
            ]);

            while (parent && !statementTypes.has(parent.value.type)) {
              parent = parent.parent;
            }

            if (parent && parent.value) {
              // For export declarations, add comment to the export itself
              let targetNode = parent.value;
              if (
                targetNode.type !== 'ExportDefaultDeclaration' &&
                targetNode.type !== 'ExportNamedDeclaration' &&
                parent.parent &&
                (parent.parent.value.type === 'ExportDefaultDeclaration' ||
                  parent.parent.value.type === 'ExportNamedDeclaration')
              ) {
                targetNode = parent.parent.value;
              }

              const added = insertCommentOnce(targetNode, j, COMMENT_MESSAGE);
              if (added) {
                context.hasChanges = true;
              }
            }
          }
        }
      }
    }
  });

  if (context.hasChanges) {
    context.messages.push(`Not Implemented ${fileInfo.path}: Mastra primitives now require a unique id parameter.`);
  }
});
