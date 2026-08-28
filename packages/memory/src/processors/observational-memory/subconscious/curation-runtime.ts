import type { RequestContext } from '@mastra/core/request-context';
import { canonicalizeKnowledgeScope, knowledgeScopeKey } from '@mastra/core/storage';
import type {
  KnowledgeCurationLane,
  KnowledgeCurationState,
  KnowledgeScope,
  KnowledgeStorage,
} from '@mastra/core/storage';

import type { Memory } from '../../..';
import { omDebug } from '../debug';
import { CURATION_AGENT } from './curate';
import { isBackingOff, nextBackoff } from './curation-backoff';
import { curationQueryLimit, shouldCurate } from './curation-trigger';
import { resolveKnowledgeResourceId } from './scope';
import type { ResolvedSubconsciousCuration } from './types';

export interface CurationEvaluatorDeps {
  memory: Memory;
  now?: () => number;
}

export interface CurationEvaluateOptions {
  threadId: string;
  resourceId?: string;
  requestContext?: RequestContext;
  prompt?: string;
}

export interface CurationEvaluator {
  evaluate(options: CurationEvaluateOptions): Promise<void>;
}

function laneKey(lane: KnowledgeCurationLane): string {
  return `${knowledgeScopeKey(lane.scope)}\u0000${lane.sourceThreadId}\u0000${lane.agent}`;
}

export function createCurationEvaluator(
  curation: ResolvedSubconsciousCuration | null,
  deps: CurationEvaluatorDeps,
): CurationEvaluator | null {
  if (!curation) return null;
  const triggerConfig = curation.trigger
    ? {
        curationThreshold: curation.trigger.uncuratedRecords,
        curationMaxAgeMs: curation.trigger.maxAgeMs,
      }
    : undefined;
  const limit = triggerConfig ? curationQueryLimit(triggerConfig) : 1;
  if (limit < 1) return null;

  const now = deps.now ?? (() => Date.now());
  const evaluations = new Map<string, Promise<void>>();
  const fallbackStates = new Map<string, KnowledgeCurationState>();
  let warnedFallback = false;

  function warnFallback(): void {
    if (warnedFallback) return;
    warnedFallback = true;
    console.warn(
      '[mastra:memory] The configured knowledge storage does not support durable curation state; ' +
        'retry backoff is process-local until the storage adapter is upgraded.',
    );
  }

  async function getState(
    store: KnowledgeStorage,
    lane: KnowledgeCurationLane,
  ): Promise<KnowledgeCurationState | null> {
    if (store.supportsCurationState) return store.getCurationState(lane);
    warnFallback();
    return fallbackStates.get(laneKey(lane)) ?? null;
  }

  async function upsertState(store: KnowledgeStorage, state: KnowledgeCurationState): Promise<void> {
    if (store.supportsCurationState) {
      await store.upsertCurationState(state);
      return;
    }
    warnFallback();
    fallbackStates.set(laneKey(state), state);
  }

  async function clearState(store: KnowledgeStorage, lane: KnowledgeCurationLane): Promise<void> {
    if (store.supportsCurationState) {
      await store.clearCurationState(lane);
      return;
    }
    warnFallback();
    fallbackStates.delete(laneKey(lane));
  }

  async function resolveLane(options: CurationEvaluateOptions): Promise<{
    store: KnowledgeStorage;
    lane: KnowledgeCurationLane;
    effectiveResourceId: string;
  } | null> {
    const organizationId = options.requestContext?.get('organizationId');
    if (typeof organizationId !== 'string' || !organizationId.trim()) return null;
    const store = await deps.memory.storage.getStore('knowledge');
    if (!store) return null;
    const effectiveResourceId = options.resourceId ?? options.threadId;
    const scope: KnowledgeScope = canonicalizeKnowledgeScope([
      `org:${organizationId}`,
      `resource:${resolveKnowledgeResourceId(options.requestContext, effectiveResourceId)}`,
      `thread:${options.threadId}`,
    ]);
    return {
      store,
      lane: { scope, sourceThreadId: options.threadId, agent: CURATION_AGENT },
      effectiveResourceId,
    };
  }

  async function evaluateOnce(
    options: CurationEvaluateOptions,
    resolved: NonNullable<Awaited<ReturnType<typeof resolveLane>>>,
  ): Promise<void> {
    const { store, lane, effectiveResourceId } = resolved;
    const attempt = await getState(store, lane);
    if (isBackingOff(attempt, now())) {
      omDebug(`[OM:curate] backing off after ${attempt?.failures} failure(s) thread=${options.threadId}`);
      return;
    }

    const cursorBefore = await store.getCurationCursor({ sourceThreadId: options.threadId, agent: CURATION_AGENT });
    let reason: 'placement' | NonNullable<ReturnType<typeof shouldCurate>> = 'placement';
    if (triggerConfig) {
      const page = await store.knowledgeBySource({
        sourceThreadId: options.threadId,
        scope: lane.scope,
        after: cursorBefore?.lastKnowledgeId,
        limit,
        includeDeleted: false,
      });
      const triggerReason = shouldCurate({
        config: triggerConfig,
        cursor: cursorBefore,
        newRecordCount: page.records.length,
        now: now(),
      });
      if (!triggerReason) return;
      reason = triggerReason;
    }

    let outcome: 'ran' | 'no-op' | 'skipped' | 'no-model';
    try {
      outcome = (
        await deps.memory.runCuration({
          threadId: options.threadId,
          resourceId: effectiveResourceId,
          requestContext: options.requestContext,
          prompt: options.prompt,
          scope: lane.scope,
        })
      ).outcome;
    } catch (error) {
      await upsertState(store, nextBackoff(lane, attempt, 'error', now()));
      omDebug(
        `[OM:curate] threw: ${error instanceof Error ? error.message : String(error)} thread=${options.threadId}`,
      );
      return;
    }

    if (outcome === 'skipped') {
      omDebug(`[OM:curate] trigger=${reason} outcome=${outcome} thread=${options.threadId}`);
      return;
    }

    const cursorAfter = await store.getCurationCursor({ sourceThreadId: options.threadId, agent: CURATION_AGENT });
    const advanced = cursorAfter?.lastKnowledgeId !== cursorBefore?.lastKnowledgeId;
    if (outcome === 'ran' && advanced) {
      if (attempt) await clearState(store, lane);
    } else {
      await upsertState(store, nextBackoff(lane, attempt, outcome, now()));
    }

    omDebug(`[OM:curate] trigger=${reason} outcome=${outcome} advanced=${advanced} thread=${options.threadId}`);
  }

  return {
    async evaluate(options: CurationEvaluateOptions): Promise<void> {
      const resolved = await resolveLane(options);
      if (!resolved) return;
      const key = laneKey(resolved.lane);
      const previous = evaluations.get(key) ?? Promise.resolve();
      const next = previous.catch(() => {}).then(() => evaluateOnce(options, resolved));
      evaluations.set(key, next);
      try {
        await next;
      } finally {
        if (evaluations.get(key) === next) evaluations.delete(key);
      }
    },
  };
}
