import { Mastra } from '@mastra/core/mastra';

import { mainMcpServer, secondaryMcpServer } from './mcp-servers';
import { authConfig } from './auth';

/**
 * Create Mastra instance with MCP servers
 */
export const mastra = new Mastra({
  mcpServers: {
    'main-mcp': mainMcpServer,
    'secondary-mcp': secondaryMcpServer,
  },
  server: {
    auth: authConfig,
  },
});
