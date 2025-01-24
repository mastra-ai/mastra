import { Mastra } from '@mastra/core';
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';

import { chefAgent } from './agents/index';

export const mastra = new Mastra({
  agents: { chefAgent },
  deployer: new CloudflareDeployer({
    scope: '',
    projectName: '',
  }),
});
