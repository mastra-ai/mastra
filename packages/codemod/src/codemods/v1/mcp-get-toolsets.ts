import { createTransformer } from '../lib/create-transformer';
import { trackClassInstances, renameMethod } from '../lib/utils';

/**
 * Transforms MCPServer getToolsets method to listToolsets:
 * - mcp.getToolsets() → mcp.listToolsets()
 *
 * Only transforms methods on variables that were instantiated with `new MCPServer(...)`
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  // Track MCPServer instances and rename method in a single optimized pass
  const mcpInstances = trackClassInstances(j, root, 'MCPServer');
  const count = renameMethod(j, root, mcpInstances, 'getToolsets', 'listToolsets');

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push(`Transformed MCPServer method: getToolsets → listToolsets`);
  }
});
