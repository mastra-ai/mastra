import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { TestDeployer } from '@mastra/deployer/test';

const configLogger = {
  logger: createLogger({
    name: 'yo',
    level: 'info',
  }),
};

const configDeployer = {
  deployer: new TestDeployer({
    name: 'yo',
  }),
};

export const mastra = new Mastra({
  ...configLogger,
  bundler: {
    externals: ['sharp'],
  },
  ...configDeployer,
});
