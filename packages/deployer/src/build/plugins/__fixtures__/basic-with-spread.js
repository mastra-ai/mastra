import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { weatherAgent } from '@/agents';
import { TestDeployer } from '@mastra/deployer/test';

const config = {
  agents: { weatherAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
};

export const mastra = new Mastra({
  ...config,
  server: {
    port: 3000,
  },
  bundler: {
    external: ['nodemailer'],
  },
  deployer: new TestDeployer(),
});
