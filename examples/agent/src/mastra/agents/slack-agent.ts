import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

/**
 * A demo agent for Slack integration.
 *
 * Connect to Slack via `mastra.channels.slack.connect('slack-demo-agent')`.
 * This creates a Slack app, returns an OAuth URL, and after installation
 * the agent will respond to mentions and DMs automatically.
 */
export const slackDemoAgent = new Agent({
  id: 'slack-demo-agent',
  name: 'Slack Demo Agent',
  instructions: `You are a helpful assistant available in Slack.
Keep your responses concise and formatted for Slack (use *bold*, _italic_, \`code\`, etc).`,
  description: 'A demo agent that can be connected to Slack.',
  model: 'openai/gpt-5.4',
  memory: new Memory({
    options: {
      observationalMemory: true,
    },
  }),
});
