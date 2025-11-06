import { createTransformer } from '../lib/create-transformer';

/**
 * Transforms Agent property access to method calls.
 * - agent.llm → agent.getLLM()
 * - agent.tools → agent.getTools()
 * - agent.instructions → agent.getInstructions()
 *
 * Only transforms properties on variables that were instantiated with `new Agent(...)`
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Map of property names to their corresponding method names
  const propertyToMethod: Record<string, string> = {
    llm: 'getLLM',
    tools: 'getTools',
    instructions: 'getInstructions',
  };

  // Track variable names that are Agent instances
  const agentVariables = new Set<string>();

  // Find all variable declarations with new Agent() assignments
  root.find(j.VariableDeclarator).forEach(path => {
    const node = path.node;

    // Check if the init is a new Agent() expression
    if (
      node.init &&
      node.init.type === 'NewExpression' &&
      node.init.callee.type === 'Identifier' &&
      node.init.callee.name === 'Agent' &&
      node.id.type === 'Identifier'
    ) {
      agentVariables.add(node.id.name);
    }
  });

  // Early return if no Agent instances found
  if (agentVariables.size === 0) return;

  // Find all member expressions where object is an Agent variable and property is one we want to transform
  root.find(j.MemberExpression).forEach(path => {
    const node = path.node;

    // Check if the object is an identifier that's an Agent instance
    if (node.object.type !== 'Identifier' || !agentVariables.has(node.object.name)) {
      return;
    }

    // Check if the property is one we want to transform
    if (node.property.type !== 'Identifier') {
      return;
    }

    const propertyName = node.property.name;
    const methodName = propertyToMethod[propertyName];

    if (!methodName) {
      return;
    }

    // Transform the member expression to a call expression
    const callExpression = j.callExpression(j.memberExpression(node.object, j.identifier(methodName)), []);

    // Replace the member expression with the call expression
    j(path).replaceWith(callExpression);

    context.hasChanges = true;
  });

  if (context.hasChanges) {
    context.messages.push(`Transformed Agent property access to method calls`);
  }
});
