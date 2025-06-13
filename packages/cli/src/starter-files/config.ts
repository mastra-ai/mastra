import { env } from 'node:process';

export const config = {
  name: 'PROJECT_NAME',
  integrations: [],
  db: {
    provider: 'postgres',
    uri: env.DB_URL!,
  },
  runner: {
    provider: 'inngest',
    uri: env.INNGEST_URL!,
    signingKey: env.INNGEST_SIGNING_KEY!,
    eventKey: env.INNGEST_EVENT_KEY!,
  },
  workflows: {
    blueprintDirPath: '/mastra/blueprints',
    systemEvents: {},
    systemApis: [],
  },
  agents: {
    agentDirPath: '/mastra/agents',
    vectorProvider: [],
  },
  systemHostURL: env.APP_URL!,
  routeRegistrationPath: '/api/mastra',
} as const;
