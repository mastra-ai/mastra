import { createTransformer } from '../lib/create-transformer';

/**
 * Transforms MCPServer getTools method to listTools:
 * - mcp.getTools() → mcp.listTools()
 *
 * Only transforms methods on variables that were instantiated with `new MCPServer(...)`
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track variable names that are MCPServer instances
  const mcpVariables = new Set<string>();

  // Find all variable declarations with new MCPServer() assignments
  root.find(j.VariableDeclarator).forEach(path => {
    const node = path.node;

    // Check if the init is a new MCPServer() expression
    if (
      node.init &&
      node.init.type === 'NewExpression' &&
      node.init.callee.type === 'Identifier' &&
      node.init.callee.name === 'MCPServer' &&
      node.id.type === 'Identifier'
    ) {
      mcpVariables.add(node.id.name);
    }
  });

  // Early return if no MCPServer instances found
  if (mcpVariables.size === 0) return;

  // Find all call expressions where the callee is mcp.getTools
  root.find(j.CallExpression).forEach(path => {
    const node = path.node;

    // Check if callee is a member expression (e.g., mcp.getTools)
    if (node.callee.type !== 'MemberExpression') {
      return;
    }

    const callee = node.callee;

    // Check if the object is a MCPServer variable
    if (callee.object.type !== 'Identifier' || !mcpVariables.has(callee.object.name)) {
      return;
    }

    // Check if the property is 'getTools'
    if (callee.property.type !== 'Identifier' || callee.property.name !== 'getTools') {
      return;
    }

    // Rename the method to 'listTools'
    callee.property.name = 'listTools';
    context.hasChanges = true;
  });

  if (context.hasChanges) {
    context.messages.push(`Transformed MCPServer method: getTools → listTools`);
  }
});
