import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

import { slackPostMessage, slackListChannels, githubCreateIssue, githubListRepos } from '../tools';

export const connectAgent = new Agent({
  name: 'Connect Agent',
  instructions: `You are a helpful assistant that can interact with Slack and GitHub on behalf of the user.
You have access to tools that use Vercel Connect to obtain short-lived, scoped tokens at runtime
instead of relying on long-lived API keys.

When asked to interact with Slack, use the slack tools. When asked to interact with GitHub, use the github tools.
Always confirm the action you're about to take before executing it.`,
  model: openai('gpt-4o-mini'),
  tools: {
    slackPostMessage,
    slackListChannels,
    githubCreateIssue,
    githubListRepos,
  },
});
