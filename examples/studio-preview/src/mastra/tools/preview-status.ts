import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const previewAreaSchema = z.enum(['studio', 'agent', 'api', 'vercel']);

export const previewStatusTool = createTool({
  id: 'preview-status',
  description: 'Returns deterministic status details for a Studio Vercel preview area.',
  inputSchema: z.object({
    area: previewAreaSchema.describe('The preview area to inspect.'),
  }),
  execute: async ({ area }) => {
    const checks = {
      studio: [
        'Studio static assets are served from the deployment root.',
        'Client-side routes fall back to index.html.',
      ],
      agent: ['The preview agent is registered.', 'Agent chat is available at /agents/studio-preview-agent/chat/new.'],
      api: ['Mastra API routes are served under /api/*.', 'The agents list is available at /api/agents.'],
      vercel: [
        'The Vercel deployer emits Build Output API v3 files.',
        'Studio assets are copied into .vercel/output/static.',
      ],
    } satisfies Record<z.infer<typeof previewAreaSchema>, string[]>;

    return {
      area,
      status: 'ready',
      checks: checks[area],
      generatedAt: new Date().toISOString(),
    };
  },
});
