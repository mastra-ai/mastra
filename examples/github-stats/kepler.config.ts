import { Config } from '@kpl/core';
import { GithubIntegration } from '@kpl/github';

export const config: Config = {
  name: 'github-stats',
  //logConfig: {}, // TODO: Add this
  systemApis: [],
  systemEvents: {},
  integrations: [new GithubIntegration()],
  db: {
    provider: 'postgres',
    uri: 'postgresql://postgres:postgres@127.0.0.1:5432/kepler?schema=kepler',
  },
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/kepler',
  blueprintDirPath: '/kepler-blueprints',
};
