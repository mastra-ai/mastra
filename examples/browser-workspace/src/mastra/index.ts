import { Mastra } from '@mastra/core/mastra';
import { ConsoleLogger, LogLevel } from '@mastra/core/logger';
import { LibSQLStore } from '@mastra/libsql';
import { browserAgent } from './agents/index.js';

export const mastra = new Mastra({
  agents: {
    browserAgent,
  },
  storage: new LibSQLStore({
    id: 'browser-workspace-storage',
    url: 'file:./mastra.db',
  }),
  logger: new ConsoleLogger({ name: 'Mastra', level: LogLevel.INFO }),
});
