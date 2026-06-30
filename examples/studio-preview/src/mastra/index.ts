import { Mastra, type Config } from '@mastra/core/mastra';
import { VercelDeployer } from '@mastra/deployer-vercel';
import { MastraEditor } from '@mastra/editor';
import { editorShowcaseAgent, studioPreviewAgent } from './agents/studio-preview-agent';
import { previewScorers } from './scorers/preview-scorers';
import { seedStudioPreview } from './seed/seed';
import { storage } from './store';
import { previewStatusTool } from './tools/preview-status';

export const mastra = new Mastra({
  agents: {
    studioPreviewAgent,
    editorShowcaseAgent,
  },
  tools: {
    previewStatusTool,
  },
  // Registering an editor flips `cmsEnabled` on for the preview so the sidebar's
  // capability footer surfaces the Editor capability. `source: 'code'` keeps the
  // code-defined agents as the source of truth; overrides live in the in-memory
  // store (reset on each cold start, like the rest of the preview data).
  editor: new MastraEditor({ source: 'code' }),
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
