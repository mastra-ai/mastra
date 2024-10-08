// @ts-ignore
import { Config } from '@mastra/core';

export const config: Config = {
  name: 'PROJECT_NAME',
  integrations: [],
  db: {
    provider: 'postgres',
    uri: process.env.DB_URL!,
  },
  workflows: {
    blueprintDirPath: '/mastra-blueprints',
    systemEvents: {},
    systemApis: [],
  },
  agents: {
    agentDirPath: '/mastra-agents',
    vectorProvider: [],
  },
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/mastra',
};
