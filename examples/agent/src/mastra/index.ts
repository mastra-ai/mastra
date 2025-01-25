import { Mastra, createLogger } from '@mastra/core';
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';

import { chefAgent } from './agents/index';

export const mastra = new Mastra({
  agents: { chefAgent },
  logger: createLogger({ name: 'Chef', level: 'debug' }),
  deployer: new CloudflareDeployer({
    scope: '',
    projectName: '',
  }),
});
