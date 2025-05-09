import { Mastra } from '@mastra/core';
import { weatherAgent } from './agents/weather';
import { myMcpServer } from './mcp';

export const mastra = new Mastra({
  agents: {
    test: weatherAgent,
  },
  mcpServers: {
    myMcpServer,
  },
});
