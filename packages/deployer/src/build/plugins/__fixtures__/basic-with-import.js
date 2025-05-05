import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { weatherAgent } from '@/agents';
import { testDeployer } from '@mastra/deployer/test';
import { telemetryConfig } from '@/telemetry';
import { serverOptions } from '@/server';

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
