import { SlackChannel } from '@mastra/channel-slack';

if (!process.env.SLACK_SIGNING_SECRET) {
  throw new Error('SLACK_SIGNING_SECRET environment variable is required');
}
if (!process.env.SLACK_BOT_TOKEN) {
  throw new Error('SLACK_BOT_TOKEN environment variable is required');
}

export const slack = new SlackChannel({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  botToken: process.env.SLACK_BOT_TOKEN,
  routes: {
    'slack-agent': {
      events: ['message', 'mention'],
    },
  },
});
