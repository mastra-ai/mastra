import { createLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import { TestDeployer } from '@mastra/deployer/test';
import { weatherAgent } from '@/agents';

export const mastra = new Mastra({
  agents: { weatherAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
  server: {
    port: 3000,
  },
  bundler: {
    external: ['nodemailer'],
  },
  deployer: new TestDeployer(),
});
