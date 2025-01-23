import { Mastra } from '@mastra/core';
import { VercelDeployer } from '@mastra/deployer-vercel';

// import { CloudflareDeployer } from '@mastra/deployer-cloudflare';
// import { NetlifyDeployer } from '@mastra/deployer-netlify';
import { chefAgent } from './agents/index';

// const cf = new CloudflareDeployer({
//   scope: '66d175c352385eecf41cf5ac9afdcc61',
//   projectName: `mastra-netlify-test`,
// })

const vercel = new VercelDeployer({
  scope: 'abhiaiyer91-gmailcom-s-team',
  projectName: `mastra-netlify-test`,
});

// const netlify = new NetlifyDeployer({
//   scope: 'abhiaiyer91',
//   projectName: `mastra-netlify-test`,
// })

export const mastra = new Mastra({
  agents: { chefAgent },
  deployer: vercel,
});
