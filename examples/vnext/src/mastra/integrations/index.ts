import { ClaudeIntegration } from '@mastra/claude';
import { GithubIntegration } from '@mastra/github';

export const integrations = [
  new GithubIntegration({
    config: {
      PERSONAL_ACCESS_TOKEN: process.env.PAT!,
    },
  }),
  new ClaudeIntegration({
    config: {
      ANTHROPIC_API_KEY: '123',
    },
  }),
];
