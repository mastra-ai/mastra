import { GithubIntegration } from '@mastra/github';

export const integrations = [
  new GithubIntegration({
    config: {
      PERSONAL_ACCESS_TOKEN: process.env.PAT!,
    },
  }),
];
