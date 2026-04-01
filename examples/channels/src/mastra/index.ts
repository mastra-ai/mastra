import { Mastra } from '@mastra/core/mastra';
import { ConsoleLogger } from '@mastra/core/logger';
import { LibSQLStore } from '@mastra/libsql';

import { exampleAgent } from './agents';

export const mastra = new Mastra({
  logger: new ConsoleLogger({ name: 'Mastra', level: 'debug', components: ['CHANNEL'] }),
  storage: new LibSQLStore({
    id: 'channels-example-storage',
    url: 'file:./mastra.db',
  }),
  agents: { exampleAgent },
});
