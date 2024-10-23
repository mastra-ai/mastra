import { Config } from '@mastra/core';
import { GithubIntegration } from '@mastra/github';

export const config: Config = {
  name: 'github-stats',
  integrations: [new GithubIntegration()],
  db: {
    provider: 'postgres',
    uri: 'postgresql://postgres:postgres@127.0.0.1:5432/mastra?schema=mastra',
  },
  workflows: {
    systemApis: [],
    systemEvents: {},
    blueprintDirPath: '/mastra/blueprints',
  },
  agents: {
    agentDirPath: '/mastra/agents',
    vectorProvider: [],
  },
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/mastra',
};
