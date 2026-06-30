import { Mastra, type Config } from '@mastra/core/mastra';
import { VercelDeployer } from '@mastra/deployer-vercel';
import { studioPreviewAgent } from './agents/studio-preview-agent';
import { previewScorers } from './scorers/preview-scorers';
import { seedStudioPreview } from './seed/seed';
import { storage } from './store';
import { previewStatusTool } from './tools/preview-status';

export const mastra = new Mastra({
  agents: {
    studioPreviewAgent,
  },
  tools: {
    previewStatusTool,
  },
  scorers: previewScorers,
  // Shared in-memory storage: serverless-friendly and seeded with demo data so
  // reviewers can preview threads, traces, metrics, scores, and datasets.
  storage,
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

// Populate the in-memory store on startup. Writes are synchronous and fast, so
// this resolves almost immediately; it is intentionally not awaited so it never
// blocks server boot. Each cold start re-seeds its own process.
void seedStudioPreview();
