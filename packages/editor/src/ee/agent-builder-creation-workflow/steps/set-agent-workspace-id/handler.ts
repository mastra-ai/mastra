import type { Agent } from '@mastra/core/agent';
import { z } from 'zod-v4';

import type { IdNameEntry } from '../../types';

const workspaceSelectionSchema = z.object({
  id: z
    .string()
    .describe('Id of the workspace the agent should be attached to, or an empty string when none is appropriate'),
});

/**
 * Resolve the workspace id to attach the agent to.
 *
 * If an explicit `workspaceId` is provided it is normalized (trim + drop empties)
 * and used as-is. Otherwise, when `availableWorkspaces` are supplied, the
 * injected agent picks at most one from that list (or none). Returns undefined
 * when neither yields a usable id.
 *
 * Infra-agnostic: receives a ready-to-use `Agent` (dependency-injected by the
 * step) and explicit domain args, never a workflow `ctx`.
 */
export async function resolveWorkspaceId(
  agent: Agent,
  workspaceId?: string,
  availableWorkspaces?: IdNameEntry[],
): Promise<string | undefined> {
  const trimmed = workspaceId?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }

  const candidates = (availableWorkspaces ?? []).filter(
    entry => entry && typeof entry.id === 'string' && entry.id.length > 0,
  );
  if (candidates.length === 0) {
    return undefined;
  }

  const result = await agent.generate(
    `Choose at most one workspace for the agent to attach to, or none. ` +
      `Return an id from this list or an empty string:\n\n${JSON.stringify(candidates)}`,
    { structuredOutput: { schema: workspaceSelectionSchema } },
  );

  const chosen = result.object.id?.trim();
  const match = candidates.find(entry => entry.id === chosen);
  return match ? match.id : undefined;
}
