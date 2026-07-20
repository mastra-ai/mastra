import type { MastraUnion } from '../../action';
import type { RequestContext } from '../../request-context';
import type { GoalObjectiveRecord } from '../../storage/domains/thread-state/base';
import { cacheGoalObjective, clearCachedGoalObjective } from './activity-cache';
import { readObjective, resolveGoalStore, writeObjective } from './objective';
import type { ResolvedGoalStore } from './objective';

interface ActiveGoalSegment {
  mastra: MastraUnion | undefined;
  agentId: string;
  threadId: string;
  objectiveId: string;
  startedAt: number;
  store: ResolvedGoalStore;
}

interface GoalActivityTarget {
  mastra: MastraUnion | undefined;
  agentId: string;
  threadId: string | undefined;
  runId: string;
  requestContext?: RequestContext;
  now?: () => number;
}

const activeSegments = new Map<string, ActiveGoalSegment>();
const checkpointedDurations = new Map<string, { objectiveId: string; durationMs: number }>();
const writeQueues = new WeakMap<ResolvedGoalStore, Map<string, Promise<void>>>();

function objectiveScopeKey(agentId: string, threadId: string): string {
  return `${agentId}:${threadId}`;
}

function segmentKey(agentId: string, runId: string): string {
  return `${agentId}:${runId}`;
}

function normalizeDuration(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : 0;
}

function debugFailure(mastra: MastraUnion | undefined, message: string, context: Record<string, unknown>): void {
  try {
    mastra?.getLogger()?.debug(message, context);
  } catch {
    // Logging must not turn best-effort timing persistence into an agent failure.
  }
}

function enqueueThreadWrite(store: ResolvedGoalStore, threadId: string, write: () => Promise<void>): Promise<void> {
  let storeQueues = writeQueues.get(store);
  if (!storeQueues) {
    storeQueues = new Map();
    writeQueues.set(store, storeQueues);
  }

  const previous = storeQueues.get(threadId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(write);
  storeQueues.set(threadId, next);
  return next.finally(() => {
    if (storeQueues.get(threadId) === next) {
      storeQueues.delete(threadId);
    }
  });
}

/** Begin an in-process active-pursuit segment for an active thread objective. */
export async function beginGoalActivity({
  mastra,
  agentId,
  threadId,
  runId,
  requestContext,
  now = Date.now,
}: GoalActivityTarget): Promise<void> {
  if (!threadId) return;

  const key = segmentKey(agentId, runId);
  if (activeSegments.has(key)) return;

  clearCachedGoalObjective(requestContext);
  let store: ResolvedGoalStore | undefined;
  let objective: GoalObjectiveRecord | undefined;
  try {
    store = await resolveGoalStore(mastra);
    objective = await readObjective(store, threadId);
    cacheGoalObjective(requestContext, threadId, objective);
  } catch (error) {
    debugFailure(mastra, 'Failed to begin goal activity tracking', { error, agentId, threadId, runId });
    return;
  }
  if (!store || objective?.status !== 'active') return;

  const objectiveId = objective.id ?? objective.objective;
  checkpointedDurations.set(objectiveScopeKey(agentId, threadId), {
    objectiveId,
    durationMs: normalizeDuration(objective.activeDurationMs),
  });
  activeSegments.set(key, { mastra, agentId, threadId, objectiveId, startedAt: now(), store });
}

/**
 * Stop and durably checkpoint an active-pursuit segment. Calling this for an
 * already-stopped run is a no-op.
 */
export async function stopGoalActivity({
  agentId,
  runId,
  now = Date.now,
}: Pick<GoalActivityTarget, 'agentId' | 'runId' | 'now'>): Promise<void> {
  const key = segmentKey(agentId, runId);
  const segment = activeSegments.get(key);
  if (!segment) return;

  activeSegments.delete(key);
  const stoppedAt = now();
  const elapsedMs = Math.max(0, stoppedAt - segment.startedAt);

  try {
    await enqueueThreadWrite(segment.store, segment.threadId, async () => {
      const objective = await readObjective(segment.store, segment.threadId);
      if (!objective || (objective.id ?? objective.objective) !== segment.objectiveId) return;

      const activeDurationMs = normalizeDuration(objective.activeDurationMs) + elapsedMs;
      const updated: GoalObjectiveRecord = {
        ...objective,
        activeDurationMs,
        updatedAt: Math.max(objective.updatedAt, stoppedAt),
      };
      await writeObjective(segment.store, segment.threadId, updated);
      checkpointedDurations.set(objectiveScopeKey(segment.agentId, segment.threadId), {
        objectiveId: segment.objectiveId,
        durationMs: activeDurationMs,
      });
    });
  } catch (error) {
    debugFailure(segment.mastra, 'Failed to persist goal activity duration', {
      error,
      agentId: segment.agentId,
      threadId: segment.threadId,
      runId,
    });
  }
}

/** Read the persisted duration plus all live core-owned segments for display. */
export function getGoalActivityDurationMs({
  agentId,
  threadId,
  objectiveId,
  activeDurationMs,
  now = Date.now,
}: {
  agentId: string;
  threadId: string | undefined;
  objectiveId: string | undefined;
  activeDurationMs: number | undefined;
  now?: () => number;
}): number {
  let durationMs = normalizeDuration(activeDurationMs);
  if (!threadId || !objectiveId) return durationMs;
  const checkpoint = checkpointedDurations.get(objectiveScopeKey(agentId, threadId));
  if (checkpoint?.objectiveId === objectiveId) {
    durationMs = Math.max(durationMs, checkpoint.durationMs);
  }

  for (const segment of activeSegments.values()) {
    if (segment.agentId === agentId && segment.threadId === threadId && segment.objectiveId === objectiveId) {
      durationMs += Math.max(0, now() - segment.startedAt);
    }
  }
  return durationMs;
}
