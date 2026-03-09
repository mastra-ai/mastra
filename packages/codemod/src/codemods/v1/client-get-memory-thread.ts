import { createTransformer } from '../lib/create-transformer';

/**
 * Updates getMemoryThread method to use object parameter instead of positional arguments.
 * This provides a more consistent API across memory methods.
 *
 * Before:
 * const thread = await client.getMemoryThread(threadId, agentId);
 *
 * After:
 * const thread = await client.getMemoryThread({ threadId, agentId });
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track MastraClient instances
  const clientInstances = new Set<string>();

  // Find MastraClient instances
  root
    .find(j.NewExpression, {
      callee: {
        type: 'Identifier',
        name: 'MastraClient',
      },
    })
    .forEach(path => {
      const parent = path.parent.value;
      if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        clientInstances.add(parent.id.name);
      }
    });

  // Find client.getMemoryThread() calls
  root
    .find(j.CallExpression)
    .filter(path => {
      const { callee } = path.value;
      if (callee.type !== 'MemberExpression') return false;
      if (callee.object.type !== 'Identifier') return false;
      if (callee.property.type !== 'Identifier') return false;

      // Check if it's getMemoryThread called on a MastraClient instance
      return clientInstances.has(callee.object.name) && callee.property.name === 'getMemoryThread';
    })
    .forEach(path => {
      const args = path.value.arguments;

      // Check if it has exactly 2 arguments (threadId, agentId)
      if (args.length === 2) {
        const threadIdArg = args[0];
        const agentIdArg = args[1];

        if (!threadIdArg || !agentIdArg) return;

        // Skip if arguments are spread elements
        if (threadIdArg.type === 'SpreadElement' || agentIdArg.type === 'SpreadElement') return;

        // Helper to create property with proper typing
        type ExpressionKind = Exclude<typeof threadIdArg, { type: 'SpreadElement' }>;
        type PropertyNode = ReturnType<typeof j.property>;

        const createProperty = (key: string, value: ExpressionKind, useShorthand: boolean): PropertyNode => {
          const prop = j.property('init', j.identifier(key), value);
          if (useShorthand) {
            prop.shorthand = true;
          }
          return prop;
        };

        // Create object properties using jscodeshift builders
        const properties: PropertyNode[] = [];

        // Check if we can use shorthand for threadId
        const threadIdShorthand = threadIdArg.type === 'Identifier' && threadIdArg.name === 'threadId';
        properties.push(createProperty('threadId', threadIdArg, threadIdShorthand));

        // Check if we can use shorthand for agentId
        const agentIdShorthand = agentIdArg.type === 'Identifier' && agentIdArg.name === 'agentId';
        properties.push(createProperty('agentId', agentIdArg, agentIdShorthand));

        // Replace with single object argument
        path.value.arguments = [j.objectExpression(properties)];
        context.hasChanges = true;
      }
    });

  if (context.hasChanges) {
    context.messages.push(
      'Updated getMemoryThread method calls to use object parameter instead of positional arguments',
    );
  }
});
