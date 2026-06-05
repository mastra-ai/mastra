import type { Agent } from '@mastra/core/agent';
import { z } from 'zod-v4';

import type { IdNameEntry } from '../../types';

const selectionSchema = z.object({
  ids: z.array(z.string()).describe('Ids of the stored skills the agent should be attached to'),
});

/**
 * Resolve attached skills into a `Record<id, true>`. The injected agent selects
 * the minimum set of relevant skills from the supplied entries; the result
 * mirrors how the playground `set-agent-skills` tool stores skills.
 *
 * Infra-agnostic: receives a ready-to-use `Agent` (dependency-injected by the
 * step) and explicit domain args, never a workflow `ctx`.
 */
export async function resolveSkills(agent: Agent, entries: IdNameEntry[]) {
  const candidates = entries.filter(entry => entry && typeof entry.id === 'string' && entry.id.length > 0);

  const record: Record<string, boolean> = {};
  if (candidates.length === 0) {
    return record;
  }

  const result = await agent.generate(
    `Select the minimum set of relevant skills for the agent. ` +
      `Return only ids from this list:\n\n${JSON.stringify(candidates)}`,
    { structuredOutput: { schema: selectionSchema } },
  );

  const selected = new Set(result.object.ids);
  for (const entry of candidates) {
    if (selected.has(entry.id)) {
      record[entry.id] = true;
    }
  }
  return record;
}
