import { createTransformer } from '../lib/create-transformer';

/**
 * Renames context.runCount to context.retryCount in step execution functions.
 * This provides clearer naming that better describes retry behavior.
 *
 * Before:
 * createStep({
 *   execute: async (inputData, context) => {
 *     console.log(`Step run ${context.runCount} times`);
 *   },
 * });
 *
 * After:
 * createStep({
 *   execute: async (inputData, context) => {
 *     console.log(`Step retry count: ${context.retryCount}`);
 *   },
 * });
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const oldPropertyName = 'runCount';
  const newPropertyName = 'retryCount';

  // Track context parameter names in createStep execute functions
  const contextParamNames = new Set<string>();

  // Find createStep calls and extract context parameter names
  root
    .find(j.CallExpression, {
      callee: {
        type: 'Identifier',
        name: 'createStep',
      },
    })
    .forEach(path => {
      const args = path.value.arguments;
      if (args.length === 0 || args[0]?.type !== 'ObjectExpression') return;

      const configObj = args[0];
      if (!configObj.properties) return;

      // Find the execute property
      configObj.properties.forEach(prop => {
        if (
          (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
          prop.key &&
          prop.key.type === 'Identifier' &&
          prop.key.name === 'execute'
        ) {
          const value = prop.value;
          if (value && (value.type === 'ArrowFunctionExpression' || value.type === 'FunctionExpression')) {
            // Extract the second parameter name (context)
            const params = value.params;
            const secondParam = params && params.length >= 2 ? params[1] : null;
            if (secondParam && secondParam.type === 'Identifier') {
              contextParamNames.add(secondParam.name);
            }
          }
        }
      });
    });

  // Rename context.runCount to context.retryCount
  const renameMemberProperty = (
    node: ReturnType<typeof j.memberExpression> | ReturnType<typeof j.optionalMemberExpression>,
  ) => {
    // Check if accessing .runCount on a context parameter
    if (
      node.object.type === 'Identifier' &&
      contextParamNames.has(node.object.name) &&
      node.property.type === 'Identifier' &&
      node.property.name === oldPropertyName
    ) {
      node.property.name = newPropertyName;
      context.hasChanges = true;
    }
  };

  // Handle regular member expressions (context.runCount)
  root.find(j.MemberExpression).forEach(path => {
    renameMemberProperty(path.value);
  });

  // Handle optional member expressions (context?.runCount)
  root.find(j.OptionalMemberExpression).forEach(path => {
    renameMemberProperty(path.value);
  });

  if (context.hasChanges) {
    context.messages.push('Renamed context.runCount to context.retryCount in step execution functions');
  }
});
