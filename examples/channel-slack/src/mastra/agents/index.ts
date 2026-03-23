import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const slackAgent = new Agent({
  id: 'slack-agent',
  name: 'Slack Agent',
  instructions: `You are a helpful assistant that responds to messages in Slack.
Keep your responses concise and conversational.`,
  model: openai('gpt-4o-mini'),
});
