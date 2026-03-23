import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';

import { slackAgent } from './agents';
import { slack } from './channels';

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: 'channel-slack-storage',
    url: 'file:./mastra.db',
  }),
  agents: { slackAgent },
  channels: { slack },
});
