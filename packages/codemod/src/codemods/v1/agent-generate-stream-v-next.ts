import { createTransformer } from '../lib/create-transformer';

/**
 * Transforms Agent VNext methods to their standard names:
 * - agent.generateVNext() → agent.generate()
 * - agent.streamVNext() → agent.stream()
 *
 * Only transforms methods on variables that were instantiated with `new Agent(...)`
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Map of old method names to new method names
  const methodRenames: Record<string, string> = {
    generateVNext: 'generate',
    streamVNext: 'stream',
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

  // Find all call expressions that are agent VNext methods
  root.find(j.CallExpression).forEach(path => {
    const node = path.node;

    // Check if callee is a member expression (e.g., agent.generateVNext)
    if (node.callee.type !== 'MemberExpression') {
      return;
    }

    const callee = node.callee;

    // Check if the object is an Agent variable
    if (callee.object.type !== 'Identifier' || !agentVariables.has(callee.object.name)) {
      return;
    }

    // Check if the property is a VNext method we want to rename
    if (callee.property.type !== 'Identifier') {
      return;
    }

    const oldMethodName = callee.property.name;
    const newMethodName = methodRenames[oldMethodName];

    if (!newMethodName) {
      return;
    }

    // Rename the method
    callee.property.name = newMethodName;
    context.hasChanges = true;
  });

  if (context.hasChanges) {
    context.messages.push(`Transformed Agent VNext methods: generateVNext/streamVNext → generate/stream`);
  }
});
