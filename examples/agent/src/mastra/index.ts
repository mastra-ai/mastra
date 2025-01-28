import { Mastra, createLogger } from '@mastra/core';
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';

import { chefAgent } from './agents/index';

export const mastra = new Mastra({
  agents: { chefAgent },
  logger: createLogger({ name: 'Chef', level: 'debug' }),
  deployer: new CloudflareDeployer({
    scope: '66d175c352385eecf41cf5ac9afdcc61',
    projectName: 'mastra-netlify-test',
  }),
});
