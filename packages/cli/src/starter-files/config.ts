export const config = {
  name: 'PROJECT_NAME',
  integrations: [],
  db: {
    provider: 'postgres',
    uri: process.env.DB_URL!,
  },
  runner: {
    provider: 'inngest',
    uri: process.env.INNGEST_URL!,
    signingKey: process.env.INNGEST_SIGNING_KEY!,
    eventKey: process.env.INNGEST_EVENT_KEY!,
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
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/mastra',
} as const;
