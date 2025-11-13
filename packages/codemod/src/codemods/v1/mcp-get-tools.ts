import { createTransformer } from '../lib/create-transformer';
import { trackClassInstances, renameMethod } from '../lib/utils';

/**
 * Transforms MCPServer getTools method to listTools:
 * - mcp.getTools() → mcp.listTools()
 *
 * Only transforms methods on variables that were instantiated with `new MCPServer(...)`
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  // Track MCPServer instances and rename method in a single optimized pass
  const mcpInstances = trackClassInstances(j, root, 'MCPServer');
  const count = renameMethod(j, root, mcpInstances, 'getTools', 'listTools');

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push(`Transformed MCPServer method: getTools → listTools`);
  }
});
