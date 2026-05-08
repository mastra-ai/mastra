import { createLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import { testDeployer } from '@mastra/deployer/test';
import { weatherAgent } from '@/agents';
import { serverOptions } from '@/server';
import { telemetryConfig } from '@/telemetry';

export const mastra = new Mastra({
  agents: { weatherAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
  telemetry: telemetryConfig,
  deployer: testDeployer,
  server: serverOptions,
});
