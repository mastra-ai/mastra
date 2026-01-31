import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { createApiRoute } from '@mastra/core/server';
import { weatherAgent } from '@/agents';
import { testDeployer } from '@mastra/deployer/test';

function getDeployer() {
  return testDeployer;
}

function getTelemetryConfig() {
  return {
    enabled: true,
    serviceName: 'my-app',
    export: {
      type: 'otlp',
      endpoint: 'http://localhost:4318', // SigNoz local endpoint
    },
  };
}

function getServerOptions() {
  return {
    port: 3000,
    timeout: 5000,
    apiRoutes: [
      createApiRoute({
        path: '/hello',
        method: 'get',
        handler: async (req, res) => {
          res.send('Hello World');
        },
      }),
    ],
  };
}

export const mastra = new Mastra({
  agents: { weatherAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
  telemetry: getTelemetryConfig(),
  server: getServerOptions(),
  deployer: getDeployer(),
});
