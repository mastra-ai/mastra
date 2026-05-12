import { MCPServer } from '@mastra/mcp';

import { calculatorTool, stringTool } from '../tools/index.js';

export const testMcpServer = new MCPServer({
  name: 'Test MCP Server',
  version: '1.0.0',
  tools: {
    calculator: calculatorTool,
    'string-transform': stringTool,
  },
});
