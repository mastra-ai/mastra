import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { TestDeployer } from '@mastra/deployer/test';
import { name } from './example.json';

export const mastra = new Mastra({
  logger: createLogger({
    name: name,
    level: 'info',
  }),
  deployer: new TestDeployer({
    name: name,
  }),
});
