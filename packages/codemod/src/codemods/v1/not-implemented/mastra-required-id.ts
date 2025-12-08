/* eslint-disable no-warning-comments */
import type { ASTPath } from 'jscodeshift';

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

  const STATEMENT_TYPES = new Set([
    'VariableDeclaration',
    'ExpressionStatement',
    'ReturnStatement',
    'ExportDefaultDeclaration',
    'ExportNamedDeclaration',
    'Program',
  ]);

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

  /**
   * Checks if an expression's arguments contain an object with an 'id' property
   */
  function hasIdProperty(args: ASTPath<any>['value']['arguments']): boolean {
    return args.some((arg: ASTPath<any>['value']) => {
      if (arg.type === 'ObjectExpression') {
        return arg.properties?.some(
          (prop: ASTPath<any>['value']) =>
            (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
            prop.key?.type === 'Identifier' &&
            prop.key.name === 'id',
        );
      }
      return false;
    });
  }

  /**
   * Adds a FIXME comment to the appropriate node based on the expression's context.
   * - If nested in an object property, adds comment to the property
   * - If nested in an array, adds comment to the expression itself
   * - Otherwise, walks up to find the parent statement and adds comment there
   */
  function addCommentToAppropriateNode(path: ASTPath<any>): void {
    let parent = path.parent;

    // If the direct parent is an object property, add comment to that property
    if (parent?.value && (parent.value.type === 'Property' || parent.value.type === 'ObjectProperty')) {
      if (insertCommentOnce(parent.value, j, COMMENT_MESSAGE)) {
        context.hasChanges = true;
      }
      return;
    }

    // If the parent is an array, add comment directly to the expression
    if (parent?.value?.type === 'ArrayExpression') {
      if (insertCommentOnce(path.value, j, COMMENT_MESSAGE)) {
        context.hasChanges = true;
      }
      return;
    }

    // Find the parent statement to add comment
    while (parent && !STATEMENT_TYPES.has(parent.value.type)) {
      parent = parent.parent;
    }

    if (parent?.value) {
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

      if (insertCommentOnce(targetNode, j, COMMENT_MESSAGE)) {
        context.hasChanges = true;
      }
    }
  }

  // Find NewExpression for classes
  root.find(j.NewExpression).forEach(path => {
    if (path.value.callee.type === 'Identifier') {
      const className = path.value.callee.name;

      if (storageClasses.includes(className) && !hasIdProperty(path.value.arguments)) {
        addCommentToAppropriateNode(path);
      }
    }
  });

  // Find CallExpression for create functions
  root.find(j.CallExpression).forEach(path => {
    if (path.value.callee.type === 'Identifier') {
      const functionName = path.value.callee.name;

      if (createFunctions.includes(functionName) && !hasIdProperty(path.value.arguments)) {
        addCommentToAppropriateNode(path);
      }
    }
  });

  if (context.hasChanges) {
    context.messages.push(`Not Implemented ${fileInfo.path}: Mastra primitives now require a unique id parameter.`);
  }
});
