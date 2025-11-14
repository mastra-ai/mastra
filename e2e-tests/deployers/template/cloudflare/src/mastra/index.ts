import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { weatherWorkflow } from './workflows/weather-workflow';
import { weatherAgent } from './agents/weather-agent';
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';
import { testRoute } from './api/route/test';
import { PostgresStore } from '@mastra/pg';

const storage = new PostgresStore({
  id: 'e2e-postgres-storage',
  connectionString: 'test-connection-string',
});

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { weatherAgent },

  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  deployer: new CloudflareDeployer({
    projectName: 'hello-mastra',
    env: {
      NODE_ENV: 'production',
      API_KEY: 'test-api-key',
    },
  }),
  server: {
    apiRoutes: [testRoute],
  },
  storage,
});
