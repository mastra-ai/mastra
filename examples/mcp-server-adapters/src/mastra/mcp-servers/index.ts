import { MCPServer } from '@mastra/mcp';

import { calculatorTool, echoTool, weatherTool } from '../tools';

/**
 * Main MCP server with all tools
 */
export const mainMcpServer = new MCPServer({
  name: 'main-server',
  version: '1.0.0',
  description: 'Main MCP server with weather, calculator, and echo tools',
  tools: {
    getWeather: weatherTool,
    calculate: calculatorTool,
    echo: echoTool,
  },
});

/**
 * Secondary MCP server with a subset of tools
 */
export const secondaryMcpServer = new MCPServer({
  name: 'secondary-server',
  version: '1.0.0',
  description: 'Secondary MCP server with calculator only',
  tools: {
    calculate: calculatorTool,
  },
});
