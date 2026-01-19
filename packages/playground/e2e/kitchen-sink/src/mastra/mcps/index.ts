import { MCPServer } from '@mastra/mcp';

import { simpleMcpTool } from '../tools';

export const simpleMcpServer = new MCPServer({
  id: 'simple-mcp-server',
  name: 'Simple MCP Server',
  version: '1.0.0',
  tools: { simpleMcpTool },
});
