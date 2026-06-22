import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { previewStatusTool } from '../tools/preview-status';

const model = openai(process.env.MASTRA_PREVIEW_MODEL ?? '__AI_SDK_OPENAI_MODEL_BASE__');

export const studioPreviewAgent = new Agent({
  id: 'studio-preview-agent',
  name: 'Studio Preview Agent',
  description: 'A small agent for validating Mastra Studio PR previews on Vercel.',
  instructions: `
You are a concise product QA assistant for Mastra Studio preview deployments.
Help reviewers verify that the Studio shell, agent chat, and tool execution paths are working.
Use the preview status tool when a reviewer asks about preview health, routing, or deployment readiness.
`,
  model,
  tools: {
    previewStatusTool,
  },
});
