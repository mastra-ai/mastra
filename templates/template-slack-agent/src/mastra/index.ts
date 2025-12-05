import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { reverseAgent } from './agents/reverse-agent';
import { capsAgent } from './agents/caps-agent';
import { reverseWorkflow } from './workflows/reverse-workflow';
import { slackRoutes } from './slack/routes';

export const mastra = new Mastra({
  agents: { reverseAgent, capsAgent },
  workflows: { reverseWorkflow },
  storage: new LibSQLStore({
    id: 'mastra',
    url: 'file:./mastra.db',
  }),
  server: {
    apiRoutes: slackRoutes,
  },
  bundler: {
    externals: ['supports-color'],
  },
});
