import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { resolveConnectTools } from '../tools/connect';

export const digestSchema = z.object({
  headline: z.string().describe('One sentence capturing the overall state of play.'),
  sections: z.array(
    z.object({
      integration: z.string().describe('Integration id, e.g. "linear" or "notion".'),
      summary: z.string().describe('2-4 sentences on recent activity in this integration.'),
      highlights: z.array(z.string()).describe('Notable items, each with an identifier or title.'),
    }),
  ),
  suggestedActions: z.array(z.string()).describe('Concrete follow-ups the user might want, if any.'),
});

/**
 * Calls the Connect resolver directly (outside an agent) to see which
 * integrations are currently connected. Tool keys are `<integration>_<action>`,
 * so the integration ids are the distinct key prefixes.
 */
const discoverIntegrationsStep = createStep({
  id: 'discover-integrations',
  description: 'List the integrations currently connected to the Mastra platform project.',
  inputSchema: z.object({
    focus: z.string().optional().describe('Optional focus, e.g. "my open Linear issues" or "docs edited this week".'),
  }),
  outputSchema: z.object({
    focus: z.string().optional(),
    integrations: z.array(z.string()),
  }),
  execute: async ({ inputData, mastra }) => {
    const tools = await resolveConnectTools({ mastra });
    const integrations = [...new Set(Object.keys(tools).map(key => key.split('_')[0]!))].sort();
    return { focus: inputData.focus, integrations };
  },
});

const composeDigestStep = createStep({
  id: 'compose-digest',
  description: 'Have the Connect agent gather recent activity from each integration and compose a digest.',
  inputSchema: z.object({
    focus: z.string().optional(),
    integrations: z.array(z.string()),
  }),
  outputSchema: digestSchema,
  execute: async ({ inputData, mastra }) => {
    if (inputData.integrations.length === 0) {
      return {
        headline: 'No integrations connected yet.',
        sections: [],
        suggestedActions: [
          'Attach integrations (Linear, Notion, …) to your Mastra platform project at https://cloud.mastra.ai, then set MASTRA_PLATFORM_ACCESS_TOKEN and MASTRA_PROJECT_ID.',
        ],
      };
    }

    const agent = mastra.getAgent('connectAgent');
    const focus = inputData.focus ? `\n\nFocus on: ${inputData.focus}` : '';
    const result = await agent.generate(
      [
        {
          role: 'user',
          content: `Build an activity digest across these connected integrations: ${inputData.integrations.join(', ')}.

For each integration, use its read/list/search tools to find recent activity (roughly the last week), then summarize it. Only report what the tools actually returned. Do not create, update, or delete anything.${focus}`,
        },
      ],
      { structuredOutput: { schema: digestSchema } },
    );
    return result.object as z.infer<typeof digestSchema>;
  },
});

export const activityDigestWorkflow = createWorkflow({
  id: 'activity-digest',
  description: 'Discover connected integrations, gather recent activity from each, and compose a cross-tool digest.',
  inputSchema: z.object({
    focus: z.string().optional().describe('Optional focus, e.g. "my open Linear issues" or "docs edited this week".'),
  }),
  outputSchema: digestSchema,
})
  .then(discoverIntegrationsStep)
  .then(composeDigestStep)
  .commit();
