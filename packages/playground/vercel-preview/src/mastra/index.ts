import { Mastra } from '@mastra/core/mastra';
import { VercelDeployer } from '@mastra/deployer-vercel';
import { MastraEditor } from '@mastra/editor';
import { editorShowcaseAgent, studioPreviewAgent } from './agents/studio-preview-agent';
import { previewScorers } from './scorers/preview-scorers';
import { seedStudioPreview } from './seed/seed';
import { seedPreviewWorkflowRuns } from './seed/workflow-runs';
import { storage } from './store';
import { previewStatusTool } from './tools/preview-status';
import { previewWorkflows } from './workflows';

export const mastra = new Mastra({
  agents: {
    studioPreviewAgent,
    editorShowcaseAgent,
  },
  tools: {
    previewStatusTool,
  },
  workflows: previewWorkflows,
  // FilesystemStore cannot write to Vercel's read-only filesystem.
  editor: new MastraEditor({ source: 'db' }),
  scorers: previewScorers,
  storage,
  bundler: {
    sourcemap: true,
  },
  deployer: new VercelDeployer({
    studio: true,
    maxDuration: 60,
  }),
  server: {
    build: {
      openAPIDocs: true,
      swaggerUI: true,
    },
  },
});

void seedStudioPreview();
await seedPreviewWorkflowRuns();
