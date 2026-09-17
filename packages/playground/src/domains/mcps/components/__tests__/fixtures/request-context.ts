import type { McpToolInfo } from '@mastra/client-js';

export const contextTool: McpToolInfo = {
  id: 'context-tool',
  name: 'context-tool',
  inputSchema: JSON.stringify({ type: 'object', properties: {} }),
  _meta: { ui: { resourceUri: 'ui://context' } },
};
