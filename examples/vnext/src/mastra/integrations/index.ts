import { GmailIntegration } from '@mastra/core';
import { GithubIntegration } from '@mastra/github';

export const integrations = [
  new GmailIntegration({ apiKey: '123' }),
  new GithubIntegration({
    config: {
      PERSONAL_ACCESS_TOKEN: '123',
    },
  }),
];
