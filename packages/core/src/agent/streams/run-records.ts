/**
 * Shared ownership records for runs published on the agent stream layer.
 *
 * A plain agent run executes in one process, but a reader may reach any
 * replica. The server needs to know who owns a run before it lets a caller
 * observe or abort it, so the executing process writes a record to the shared
 * server cache before it publishes anything, and keeps its status current.
 * Any replica sharing that cache can then authorize the caller.
 *
 * Records are bounded: they carry the same TTL as the run's stream log, they
 * are deleted when the run's topic is cleared, and an evicted or expired
 * record simply makes the run unknown, so callers are refused.
 */
import type { MastraServerCache } from '../../cache/base';
import { RUN_LOG_TTL_MS } from '../../events/topics';

/**
 * - `running`: a process is executing the run and listens for abort requests.
 * - `suspended`: the run paused (tool approval or suspension); nothing executes
 *   it until it is resumed, which marks it `running` again.
 * - `finished`: the run ended (finished, failed, or aborted). Its replay
 *   history stays readable until its topic is cleared.
 */
export type AgentRunStatus = 'running' | 'suspended' | 'finished';

export interface AgentRunRecord {
  agentId: string;
  runId: string;
  resourceId?: string;
  threadId?: string;
  status: AgentRunStatus;
  updatedAt: number;
  /**
   * The publisher that last wrote this record. A finished run's cleanup compares
   * it with the record it finds, so it can tell its own run from a later one that
   * reused the id. Not used for authorization.
   */
  publisherId?: string;
}

/** Where a publisher keeps the record of its run, and whose run it is. */
export interface AgentRunRecordTarget {
  cache: MastraServerCache;
  /** Override the storage location without changing the record's lifecycle contract. */
  key?: string;
  agentId: string;
  resourceId?: string;
  threadId?: string;
}

/** Lifetime of a record. Matches the stream log so ownership never outlives the history it guards by more than one write. */
export const AGENT_RUN_RECORD_TTL_MS = RUN_LOG_TTL_MS;

export const agentRunRecordKey = (agentId: string, runId: string): string => `agent.run.${agentId}.${runId}`;

export async function writeAgentRunRecord(
  cache: MastraServerCache,
  record: AgentRunRecord,
  key = agentRunRecordKey(record.agentId, record.runId),
): Promise<void> {
  await cache.set(key, record, AGENT_RUN_RECORD_TTL_MS);
}

/**
 * Read the record of `runId` for `agentId`. Returns undefined when there is
 * none or it does not belong to that agent and run. Rejects when the cache
 * cannot be read, so callers can refuse rather than guess.
 */
export async function readAgentRunRecord(
  cache: MastraServerCache,
  agentId: string,
  runId: string,
  key = agentRunRecordKey(agentId, runId),
): Promise<AgentRunRecord | undefined> {
  const value = await cache.get(key);
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Partial<AgentRunRecord>;
  if (record.agentId !== agentId || record.runId !== runId) return undefined;
  if (record.status !== 'running' && record.status !== 'suspended' && record.status !== 'finished') return undefined;
  return record as AgentRunRecord;
}

export async function deleteAgentRunRecord(
  cache: MastraServerCache,
  agentId: string,
  runId: string,
  key = agentRunRecordKey(agentId, runId),
): Promise<void> {
  await cache.delete(key);
}

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
