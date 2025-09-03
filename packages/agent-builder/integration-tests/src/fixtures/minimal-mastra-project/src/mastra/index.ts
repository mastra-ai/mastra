import { Mastra } from '@mastra/core';
import { weatherAgent } from './agents/weather';
import { myMcpServer } from './mcp';
import { workflows } from './workflows';

export const mastra = new Mastra({
  agents: {
    weatherAgent,
  },
  workflows,
  mcpServers: {
    myMcpServer,
  },
  server: {
    port: 4199,
  },
});
