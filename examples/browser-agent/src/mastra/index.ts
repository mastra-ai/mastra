import { Mastra } from '@mastra/core/mastra';
import { ConsoleLogger, LogLevel } from '@mastra/core/logger';
import { LibSQLStore } from '@mastra/libsql';
import { agentBrowserAgent, browserUseAgent, stagehandAgent } from './agents/index.js';

export const mastra = new Mastra({
  agents: {
    agentBrowserAgent,
    browserUseAgent,
    stagehandAgent,
  },
  storage: new LibSQLStore({
    id: 'browser-agent-storage',
    url: 'file:./mastra.db',
  }),
  logger: new ConsoleLogger({ name: 'Mastra', level: LogLevel.INFO }),
});
