import { Config } from '@kpl/core';
import { GithubIntegration } from '@kpl/github';

export const config: Config = {
  name: 'github-stats',
  integrations: [new GithubIntegration()],
  db: {
    provider: 'postgres',
    uri: 'postgresql://postgres:postgres@127.0.0.1:5432/kepler?schema=kepler',
  },
  workflows: {
    systemApis: [],
    systemEvents: {},
    blueprintDirPath: '/kepler-blueprints',
  },
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/kepler',
};
