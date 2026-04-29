import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { SlackChannel } from '@mastra/slack';
import { slackDemoAgent } from './agents/slack-agent';

export const mastra = new Mastra({
  agents: {
    slackDemoAgent,
  },
  storage: new LibSQLStore({
    id: 'examples-agent',
    url: 'file:./mastra.db',
  }),
  channels: {
    slack: new SlackChannel({
      appConfigRefreshToken: process.env.SLACK_APP_CONFIG_REFRESH_TOKEN!,
      baseUrl: process.env.SLACK_BASE_URL,
    }),
  },
});
