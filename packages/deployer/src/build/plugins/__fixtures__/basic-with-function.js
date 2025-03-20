import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { weatherAgent } from './agents';
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

export const mastra = new Mastra({
  agents: { weatherAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
  telemetry: getTelemetryConfig(),
  deployer: getDeployer(),
});
