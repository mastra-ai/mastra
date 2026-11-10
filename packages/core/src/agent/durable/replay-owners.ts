/**
 * Shared read ownership for durable run replay.
 *
 * A durable run's workflow snapshot is gone once it finishes, but its replay
 * history stays in the shared cache until the run's topic is cleared. The
 * executing process knows the owner in memory; other replicas do not. So the
 * executing process writes the owner here when it registers the run, and
 * deletes it when it clears the run's topic. Any replica sharing the cache can
 * then let the owner observe the finished run, and nobody else.
 *
 * This record only grants read access (observe). It is keyed apart from the
 * plain agent run records so abort and other write paths never consult it.
 */
import type { MastraServerCache } from '../../cache/base';
import { RUN_LOG_TTL_MS } from '../../events/topics';

export interface DurableReplayOwner {
  agentId: string;
  runId: string;
  resourceId?: string;
  threadId?: string;
}

export const durableReplayOwnerKey = (agentId: string, runId: string): string =>
  `agent.durable.replay-owner.${agentId}.${runId}`;

export async function writeDurableReplayOwner(cache: MastraServerCache, owner: DurableReplayOwner): Promise<void> {
  await cache.set(durableReplayOwnerKey(owner.agentId, owner.runId), owner, RUN_LOG_TTL_MS);
}

/**
 * Read the replay owner of `runId` for `agentId`. Returns undefined when there
 * is none or it does not belong to that agent and run. Rejects when the cache
 * cannot be read, so callers can refuse rather than guess.
 */
export async function readDurableReplayOwner(
  cache: MastraServerCache,
  agentId: string,
  runId: string,
): Promise<DurableReplayOwner | undefined> {
  const value = await cache.get(durableReplayOwnerKey(agentId, runId));
  if (!value || typeof value !== 'object') return undefined;
  const owner = value as Partial<DurableReplayOwner>;
  if (owner.agentId !== agentId || owner.runId !== runId) return undefined;
  return owner as DurableReplayOwner;
}

export async function deleteDurableReplayOwner(
  cache: MastraServerCache,
  agentId: string,
  runId: string,
): Promise<void> {
  await cache.delete(durableReplayOwnerKey(agentId, runId));
}
