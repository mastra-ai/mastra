import { createTransformer } from '../lib/create-transformer';
import { trackClassInstances, renameMethod } from '../lib/utils';

/**
 * Transforms MCPServer and MCPClient getTools method to listTools:
 * - mcp.getTools() → mcp.listTools()
 *
 * Only transforms methods on variables that were instantiated with `new MCPServer(...)` or `new MCPClient(...)`
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  // Track MCPServer and MCPClient instances and rename method in a single optimized pass
  const mcpServerInstances = trackClassInstances(j, root, 'MCPServer');
  const mcpClientInstances = trackClassInstances(j, root, 'MCPClient');
  const mcpInstances = new Set([...mcpServerInstances, ...mcpClientInstances]);
  const count = renameMethod(j, root, mcpInstances, 'getTools', 'listTools');

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push(`Transformed MCPServer method: getTools → listTools`);
  }
});
