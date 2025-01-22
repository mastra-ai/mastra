import { Mastra } from '@mastra/core';
import { VercelDeployer } from '@mastra/deployer-vercel';

import { chefAgent } from './agents/index';

export const mastra = new Mastra({
  agents: { chefAgent },
  deployer: new VercelDeployer({
    scope: 'abhiaiyer91-gmailcom-s-team',
  }),
});
