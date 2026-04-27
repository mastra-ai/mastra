import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { SlackChannel } from '@mastra/slack';
import { slackDemoAgent } from './agents/slack-agent';
import { gatewayAgent } from './agents/gateway';

export const mastra = new Mastra({
  agents: {
    slackDemoAgent,
    gatewayAgent,
  },
  storage: new LibSQLStore({
    id: 'examples-agent',
    url: 'file:./mastra.db',
  }),
  channels: {
    slack: new SlackChannel({
      configToken: process.env.SLACK_CONFIG_TOKEN!,
      refreshToken: process.env.SLACK_CONFIG_REFRESH_TOKEN!,
      baseUrl: process.env.SLACK_BASE_URL,
    }),
  },
});
