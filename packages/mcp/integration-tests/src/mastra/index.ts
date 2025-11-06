import { Mastra } from '@mastra/core/mastra';
import { weatherAgent } from './agents/weather';
import { myMcpServer } from './mcp';

export const mastra = new Mastra({
  agents: {
    test: weatherAgent,
  },
  mcpServers: {
    myMcpServer,
  },
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 4114,
  },
});
