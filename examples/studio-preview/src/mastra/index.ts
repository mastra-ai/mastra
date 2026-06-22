import { Mastra, type Config } from '@mastra/core/mastra';
import { VercelDeployer } from '@mastra/deployer-vercel';
import { studioPreviewAgent } from './agents/studio-preview-agent';
import { previewStatusTool } from './tools/preview-status';

export const mastra = new Mastra({
  agents: {
    studioPreviewAgent,
  },
  tools: {
    previewStatusTool,
  },
  bundler: {
    sourcemap: true,
  },
  // The deployer is linked from the workspace while @mastra/core is pinned to a
  // published version for Vercel installs.
  deployer: new VercelDeployer({
    studio: true,
    maxDuration: 60,
  }) as unknown as NonNullable<Config['deployer']>,
  server: {
    build: {
      openAPIDocs: true,
      swaggerUI: true,
    },
  },
});
