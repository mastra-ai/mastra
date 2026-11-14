import type { MastraServerCache } from '../../cache/base';

export interface DurableReplayOwner {
  agentId: string;
  runId: string;
  resourceId?: string;
  threadId?: string;
}

export const durableReplayOwnerKey = (agentId: string, runId: string): string =>
  `agent.durable.replay-owner.${agentId}.${runId}`;

/** Legacy records grant replay access only, never execution status, abort, or cleanup authority. */
export async function readDurableReplayOwner(
  cache: MastraServerCache,
  agentId: string,
  runId: string,
): Promise<DurableReplayOwner | undefined> {
  const value = await cache.get(durableReplayOwnerKey(agentId, runId));
  if (!value || typeof value !== 'object') return undefined;
  const owner = value as Partial<DurableReplayOwner>;
  if (owner.agentId !== agentId || owner.runId !== runId) return undefined;
  return { agentId, runId, resourceId: owner.resourceId, threadId: owner.threadId };
}
