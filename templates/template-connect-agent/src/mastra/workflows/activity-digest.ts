import { PROVIDERS } from '@mastra/connect';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { connectTools } from '../agents/connect-agent';

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
 * Verbs that mutate connected data. The digest run only reads, so any tool
 * whose `<integration>_<action>` key contains one of these is withheld from
 * the agent via `activeTools`. Deny-by-verb (rather than allow-by-verb) so a
 * tool like `notion_append_bulleted_list` is excluded even though it ends in
 * a read-sounding word.
 */
const WRITE_VERBS =
  /(^|_)(create|update|delete|append|add|remove|set|send|archive|unarchive|cancel|revoke|upsert|insert|move|duplicate|share|restore|resend|replay|publish|invoke|execute|assign|transition|resolve|unresolve|verify|deactivate|reactivate|copy|generate|connect)(_|$)/;
const READ_VERBS = /(^|_)(get|list|search|retrieve|query|count)(_|$)/;

/**
 * Tool keys are `<integration>_<action>`, but integration ids can themselves
 * contain separators (`incident-io` → `incident_io_create_action`), so
 * splitting a key at the first underscore can truncate the id. Match each key
 * against Connect's provider registry instead (longest prefix wins), and only
 * fall back to the first segment for MCP-discovered integrations the static
 * registry doesn't know about.
 */
function integrationIdForToolKey(key: string): string {
  let best: { id: string; length: number } | undefined;
  for (const { integrationId } of PROVIDERS) {
    for (const prefix of new Set([integrationId, integrationId.replace(/-/g, '_')])) {
      if (key.startsWith(`${prefix}_`) && (!best || prefix.length > best.length)) {
        best = { id: integrationId, length: prefix.length };
      }
    }
  }
  return best?.id ?? key.split('_')[0]!;
}

/**
 * Calls the Connect resolver directly (outside an agent) to see which
 * integrations are currently connected, mapping each tool key back to its
 * integration id via the Connect provider registry.
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
    readOnlyTools: z.array(z.string()),
  }),
  execute: async ({ inputData, mastra }) => {
    const tools = await connectTools({ mastra });
    const keys = Object.keys(tools);
    const integrations = [...new Set(keys.map(integrationIdForToolKey))].sort();
    const readOnlyTools = keys.filter(key => READ_VERBS.test(key) && !WRITE_VERBS.test(key));
    return { focus: inputData.focus, integrations, readOnlyTools };
  },
});

const composeDigestStep = createStep({
  id: 'compose-digest',
  description: 'Have the Connect agent gather recent activity from each integration and compose a digest.',
  inputSchema: z.object({
    focus: z.string().optional(),
    integrations: z.array(z.string()),
    readOnlyTools: z.array(z.string()),
  }),
  outputSchema: digestSchema,
  execute: async ({ inputData, mastra }) => {
    if (inputData.integrations.length === 0) {
      return {
        headline: 'No integration tools available.',
        sections: [],
        suggestedActions: [
          'Attach integrations (Linear, Notion, …) to your Mastra platform project at https://cloud.mastra.ai, then set MASTRA_PLATFORM_ACCESS_TOKEN and MASTRA_PROJECT_ID.',
          'If integrations are already attached, check the server logs: connections that need re-authorization or are ambiguous are skipped with a warning.',
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

For each integration, use its read/list/search tools to find recent activity (roughly the last week), then summarize it. Only report what the tools actually returned.${focus}`,
        },
      ],
      {
        structuredOutput: { schema: digestSchema },
        // A digest run must not touch connected data: only the read tools
        // discovered in the previous step are active for this call.
        activeTools: inputData.readOnlyTools,
      },
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
