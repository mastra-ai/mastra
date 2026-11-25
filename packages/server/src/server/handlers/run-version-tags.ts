import { Agent } from '@mastra/core/agent';
import type { VersionOverrides } from '@mastra/core/di';
import { mergeVersionOverrides, MASTRA_VERSIONS_KEY } from '@mastra/core/di';
import type { RequestContext } from '@mastra/core/request-context';

import { HTTPException } from '../http-exception';
import type { Context } from '../types';
import { getVersionTags, isReservedVersionTag } from './version-tags';

/**
 * Reserved request context key the agent run span reads its version metadata from. Same value as
 * `MASTRA_VERSION_INFO_KEY` in `@mastra/core`, repeated here so the server still works with a core
 * that predates it (the metadata is then not reported).
 */
const VERSION_INFO_KEY = 'mastra__versionInfo';

function readString(requestContext: RequestContext, key: string): string | undefined {
  const value = requestContext.get(key);
  return typeof value === 'string' && value ? value : undefined;
}

function recordAgentVersionTag(requestContext: RequestContext, agentId: string, versionTag: string): void {
  const existing = requestContext.get(VERSION_INFO_KEY);
  const all =
    existing && typeof existing === 'object' && !Array.isArray(existing) ? (existing as Record<string, object>) : {};
  requestContext.set(VERSION_INFO_KEY, { ...all, [agentId]: { ...all[agentId], versionTag } });
}

function promptBlockRefIds(instructions: unknown): string[] {
  if (!Array.isArray(instructions)) return [];
  return instructions
    .filter(block => block?.type === 'prompt_block_ref' && typeof block.id === 'string')
    .map(block => block.id as string);
}

/**
 * Carries the version tags of a run past the agent that was called. Call it once the body's request
 * context has been merged, with the agent the request resolved to.
 *
 * - Sub-agents follow `agentVersionTag`: each one that has the tag runs its tagged version, and the
 *   rest run their published version. A version the request names for a sub-agent still wins.
 * - A `promptVersionTag` that none of the run's prompt blocks carry is a 404, the same answer an
 *   unknown agent tag gets. A tag that some of them carry is fine: the others use their published
 *   version.
 * - The tag that chose each agent's version is recorded for the agent run span.
 */
export async function applyRunVersionTags({
  mastra,
  agent,
  requestContext,
}: {
  mastra: Context['mastra'];
  agent: Agent;
  requestContext: RequestContext;
}): Promise<void> {
  // An exact version ID outranks a tag, so that request isn't a tagged run.
  const agentTag = readString(requestContext, 'agentVersionId')
    ? undefined
    : readString(requestContext, 'agentVersionTag');
  const requestedPromptTag = readString(requestContext, 'promptVersionTag');
  // "published" and "draft" select a status. They never name a sub-agent or prompt version here.
  const subAgentTag = agentTag && !isReservedVersionTag(agentTag) ? agentTag : undefined;
  const promptTag = requestedPromptTag && !isReservedVersionTag(requestedPromptTag) ? requestedPromptTag : undefined;

  if (agentTag) recordAgentVersionTag(requestContext, agent.id, agentTag);
  if (!subAgentTag && !promptTag) return;

  const agentsStore = await mastra.getStorage()?.getStore('agents');
  if (!agentsStore) return;

  const requested = requestContext.get(MASTRA_VERSIONS_KEY) as VersionOverrides | undefined;
  const taggedSubAgents: NonNullable<VersionOverrides['agents']> = {};
  const promptBlockIds = new Set<string>();
  const visited = new Set<string>([agent.id]);

  const visit = async (current: Agent, versionId: string | undefined): Promise<void> => {
    if (promptTag) {
      try {
        const stored = versionId
          ? await agentsStore.getVersion(versionId)
          : await agentsStore.getByIdResolved(current.id, { status: 'published' });
        for (const id of promptBlockRefIds(stored?.instructions)) promptBlockIds.add(id);
      } catch {
        // An agent with nothing stored references no prompt blocks.
      }
    }

    let subAgents: Record<string, unknown> = {};
    try {
      subAgents = await current.listAgents({ requestContext });
    } catch {
      // Sub-agents that can't be listed for this request won't run in it either.
    }

    for (const subAgent of Object.values(subAgents)) {
      if (!(subAgent instanceof Agent) || visited.has(subAgent.id)) continue;
      visited.add(subAgent.id);

      const requestedSelector = requested?.agents?.[subAgent.id];
      let subVersionId =
        requestedSelector && 'versionId' in requestedSelector ? requestedSelector.versionId : undefined;
      if (!requestedSelector && subAgentTag) {
        const taggedVersionId = getVersionTags(await agentsStore.getById(subAgent.id))[subAgentTag];
        if (taggedVersionId) {
          subVersionId = taggedVersionId;
          taggedSubAgents[subAgent.id] = { versionId: taggedVersionId };
          recordAgentVersionTag(requestContext, subAgent.id, subAgentTag);
        }
      }

      // Look below the version that will run, since it can name different sub-agents and prompts.
      let resolved: Agent = subAgent;
      if (subVersionId) {
        try {
          resolved = await mastra.resolveVersionedAgent(subAgent, { versionId: subVersionId });
        } catch {
          // The run falls back to the sub-agent as defined, so look below that.
        }
      }
      await visit(resolved, subVersionId);
    }
  };

  await visit(agent, agent.toRawConfig()?.resolvedVersionId as string | undefined);

  if (Object.keys(taggedSubAgents).length > 0) {
    const merged = mergeVersionOverrides(requested, { agents: taggedSubAgents });
    if (merged) requestContext.set(MASTRA_VERSIONS_KEY, merged);
  }

  if (promptTag && promptBlockIds.size > 0) {
    const promptBlocksStore = await mastra.getStorage()?.getStore('promptBlocks');
    if (!promptBlocksStore) return;
    const records = await Promise.all(Array.from(promptBlockIds, id => promptBlocksStore.getById(id)));
    if (!records.some(record => getVersionTags(record)[promptTag])) {
      throw new HTTPException(404, {
        message: `Version tag "${promptTag}" not found on any prompt block used by agent ${agent.id}`,
      });
    }
  }
}
