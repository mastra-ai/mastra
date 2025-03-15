import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { weatherAgent } from '@/agents';
import { TestDeployer } from '@mastra/deployer/test';

const testDeployer = new TestDeployer();

const telemetry = {
  enabled: true,
  serviceName: 'my-app',
  export: {
    type: 'otlp',
    endpoint: 'http://localhost:4318', // SigNoz local endpoint
  },
};

export const mastra = new Mastra({
  agents: { weatherAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
  telemetry,
  deployer: testDeployer,
});
