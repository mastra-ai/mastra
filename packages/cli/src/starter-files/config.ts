// @ts-ignore
import { Config } from '@mastra/core';

export const config: Config = {
  name: 'PROJECT_NAME',
  integrations: [],
  db: {
    provider: 'postgres',
    uri: 'postgresql://postgres:postgres@127.0.0.1:REPLACE_DB_PORT/mastra?schema=mastra',
  },
  runner: {
    provider: 'inngest',
    uri: process.env.INNGEST_URL!,
    signingKey: process.env.INNGEST_SIGNING_KEY!,
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
