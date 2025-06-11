import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

import { workingMemoryAgent } from './agents/index';
import { myMcpServer, myMcpServerTwo } from './mcp/server';
import { myWorkflow } from './workflows';

const storage = new LibSQLStore({
  url: 'file:./mastra.db',
});

export const mastra = new Mastra({
  agents: { workingMemoryAgent },
  logger: new PinoLogger({ name: 'Chef', level: 'info' }),
  storage,
  mcpServers: {
    myMcpServer,
    myMcpServerTwo,
  },
  workflows: { myWorkflow },
});
