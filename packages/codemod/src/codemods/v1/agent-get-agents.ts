import { createTransformer } from '../lib/create-transformer';

/**
 * Transforms Mastra getAgents method to listAgents:
 * - mastra.getAgents() → mastra.listAgents()
 *
 * Only transforms methods on variables that were instantiated with `new Mastra(...)`
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track variable names that are Mastra instances
  const mastraVariables = new Set<string>();

  // Find all variable declarations with new Mastra() assignments
  root.find(j.VariableDeclarator).forEach(path => {
    const node = path.node;

    // Check if the init is a new Mastra() expression
    if (
      node.init &&
      node.init.type === 'NewExpression' &&
      node.init.callee.type === 'Identifier' &&
      node.init.callee.name === 'Mastra' &&
      node.id.type === 'Identifier'
    ) {
      mastraVariables.add(node.id.name);
    }
  });

  // Early return if no Mastra instances found
  if (mastraVariables.size === 0) return;

  // Find all call expressions where the callee is mastra.getAgents
  root.find(j.CallExpression).forEach(path => {
    const node = path.node;

    // Check if callee is a member expression (e.g., mastra.getAgents)
    if (node.callee.type !== 'MemberExpression') {
      return;
    }

    const callee = node.callee;

    // Check if the object is a Mastra variable
    if (callee.object.type !== 'Identifier' || !mastraVariables.has(callee.object.name)) {
      return;
    }

    // Check if the property is 'getAgents'
    if (callee.property.type !== 'Identifier' || callee.property.name !== 'getAgents') {
      return;
    }

    // Rename the method to 'listAgents'
    callee.property.name = 'listAgents';
    context.hasChanges = true;
  });

  if (context.hasChanges) {
    context.messages.push(`Transformed Mastra method: getAgents → listAgents`);
  }
});
