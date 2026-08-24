import type { RequestContext } from '@mastra/core/request-context';
import { canonicalizeKnowledgeScope } from '@mastra/core/storage';
import type { KnowledgeStorage, ObservationalMemoryRecord } from '@mastra/core/storage';

import type { Memory } from '../../..';
import { omDebug } from '../debug';
import { CURATION_AGENT } from './curate';
import { clearedBackoff, isBackingOff, nextBackoff, readAttemptState } from './curation-backoff';
import type { CurationAttemptState } from './curation-backoff';
import { curationQueryLimit, shouldCurate } from './curation-trigger';
import { resolveKnowledgeResourceId } from './scope';
import type { ResolvedSubconsciousCuration } from './types';

/**
 * The curator runtime: the single owner of curation policy outside `ObservationalMemory`.
 *
 * Owns the bounded uncurated-record query, cursor evaluation, retry/backoff persistence, and
 * per-record evaluation serialization. Consumers (the pipeline-completion wiring) hand it a
 * generic "an observation completed" or "a reflection committed" signal and nothing else — OM
 * never knows curation exists.
 *
 * Concurrency: evaluations are serialised per record within this process via an internal map,
 * so several completion signals in the same turn cannot each decide to run. Retry state is
 * persisted on the record's `config.subconscious.curationAttempt`, so a failing curator stays
 * backed off across a restart rather than resuming once per turn.
 *
 * Known limitation — two live instances sharing one storage can still both evaluate and both
 * run the curator. Closing that needs an atomic claim, which the storage layer does not
 * currently expose for this data: `updateObservationalMemoryConfig` is an unconditional
 * deep-merge with no conditional-write argument. The curation cursor prevents acknowledged
 * input from being selected again, but it does not serialize concurrent model calls.
 */
export interface CurationEvaluatorDeps {
  /** The Memory instance whose `runCuration` executes the curator and whose storage holds knowledge. */
  memory: Memory;
  /** Re-reads a fresh observational memory record; the caller's copy may be stale. */
  getRecord: (threadId: string, resourceId?: string) => Promise<ObservationalMemoryRecord | null | undefined>;
  /** Persists curation attempt state onto the record's config jsonb. */
  updateRecordConfig: (
    recordId: string,
    config: { subconscious: { curationAttempt: CurationAttemptState } },
  ) => Promise<void>;
  /** Injected clock for tests. */
  now?: () => number;
}

export interface CurationEvaluateOptions {
  threadId: string;
  resourceId?: string;
  requestContext?: RequestContext;
}

export interface CurationEvaluator {
  /**
   * Evaluate the trigger for one completed pipeline and run the curator when it fires.
   * Serialized per thread; safe to call from multiple completion sites in the same turn.
   */
  evaluate(options: CurationEvaluateOptions): Promise<void>;
  /**
   * Read-only trigger check for reflection-placed curation: backoff + bounded query +
   * `shouldCurate`, with no cursor bookkeeping and no curator invocation. The reflection
   * commit handler runs (and advances the cursor) itself when this returns true.
   */
  gate(options: CurationEvaluateOptions): Promise<boolean>;
}

/**
 * Build the trigger evaluator for a resolved curation config, or `null` when there is no
 * trigger to evaluate (no curate entry, or a reflection placement using the default
 * commit-time policy — the reflection handler runs directly in that case).
 */
export function createCurationEvaluator(
  curation: ResolvedSubconsciousCuration | null,
  deps: CurationEvaluatorDeps,
): CurationEvaluator | null {
  if (!curation?.trigger) return null;
  const triggerConfig = {
    curationThreshold: curation.trigger.uncuratedRecords,
    curationMaxAgeMs: curation.trigger.maxAgeMs,
  };
  const limit = curationQueryLimit(triggerConfig);
  if (limit < 1) return null;

  const now = deps.now ?? (() => Date.now());
  const evaluations = new Map<string, Promise<void>>();

  /**
   * Shared read-only trigger check. Returns the fresh record, its attempt state, and the
   * trigger reason — or null when nothing should run (missing org context, no record yet,
   * backing off, no knowledge store, or the trigger did not fire).
   */
  async function checkTrigger({ threadId, resourceId, requestContext }: CurationEvaluateOptions): Promise<{
    fresh: ObservationalMemoryRecord;
    attempt: CurationAttemptState | undefined;
    reason: NonNullable<ReturnType<typeof shouldCurate>>;
    cursorBefore: Awaited<ReturnType<KnowledgeStorage['getCurationCursor']>>;
    store: KnowledgeStorage;
  } | null> {
    const organizationId = requestContext?.get('organizationId');
    if (typeof organizationId !== 'string' || !organizationId.trim()) return null;

    // Re-read the record: the caller's copy may predate a sibling completion site's write.
    const fresh = await deps.getRecord(threadId, resourceId);
    if (!fresh) return null;
    const attempt = readAttemptState(fresh.config);
    if (isBackingOff(attempt, now())) {
      omDebug(`[OM:curate] backing off after ${attempt?.failures} failure(s) thread=${threadId}`);
      return null;
    }

    const store = await deps.memory.storage.getStore('knowledge');
    if (!store) return null;

    const effectiveResourceId = resourceId ?? threadId;
    const scope = canonicalizeKnowledgeScope([
      `org:${organizationId}`,
      `resource:${resolveKnowledgeResourceId(requestContext, effectiveResourceId)}`,
      `thread:${threadId}`,
    ]);

    const cursor = await store.getCurationCursor({ sourceThreadId: threadId, agent: CURATION_AGENT });
    const page = await store.knowledgeBySource({
      sourceThreadId: threadId,
      scope,
      after: cursor?.lastKnowledgeId,
      limit,
      includeDeleted: false,
    });

    const reason = shouldCurate({
      config: triggerConfig,
      cursor,
      newRecordCount: page.records.length,
      now: now(),
    });
    if (!reason) return null;
    return { fresh, attempt, reason, cursorBefore: cursor, store };
  }

  async function evaluateOnce(options: CurationEvaluateOptions): Promise<void> {
    const { threadId, resourceId, requestContext } = options;
    const checked = await checkTrigger(options);
    if (!checked) return;
    const { fresh, attempt, reason, cursorBefore: cursor, store } = checked;
    const effectiveResourceId = resourceId ?? threadId;

    let outcome: 'ran' | 'no-op' | 'skipped' | 'no-model';
    try {
      const result = await deps.memory.runCuration({
        threadId,
        resourceId: effectiveResourceId,
        requestContext,
      });
      outcome = result.outcome;
    } catch (error) {
      await deps.updateRecordConfig(fresh.id, { subconscious: { curationAttempt: nextBackoff(attempt, now()) } });
      omDebug(`[OM:curate] threw: ${error instanceof Error ? error.message : String(error)} thread=${threadId}`);
      throw error;
    }

    // `skipped` means another same-process curation is already in flight. It is neither progress
    // nor failure, so the existing backoff state is left exactly as it was.
    if (outcome === 'skipped') {
      omDebug(`[OM:curate] trigger=${reason} outcome=${outcome} thread=${threadId}`);
      return;
    }

    const cursorAfter = await store.getCurationCursor({ sourceThreadId: threadId, agent: CURATION_AGENT });
    const advanced = cursorAfter?.lastKnowledgeId !== cursor?.lastKnowledgeId;
    if (outcome !== 'ran' || !advanced) {
      await deps.updateRecordConfig(fresh.id, { subconscious: { curationAttempt: nextBackoff(attempt, now()) } });
    } else if (attempt && attempt.failures > 0) {
      await deps.updateRecordConfig(fresh.id, { subconscious: { curationAttempt: clearedBackoff() } });
    }

    omDebug(`[OM:curate] trigger=${reason} outcome=${outcome} advanced=${advanced} thread=${threadId}`);
  }

  return {
    async evaluate(options: CurationEvaluateOptions): Promise<void> {
      const key = `${options.threadId}::${options.resourceId ?? ''}`;
      const previous = evaluations.get(key) ?? Promise.resolve();
      const next = previous.catch(() => {}).then(() => evaluateOnce(options));
      evaluations.set(key, next);
      try {
        await next;
      } finally {
        if (evaluations.get(key) === next) evaluations.delete(key);
      }
    },
    async gate(options: CurationEvaluateOptions): Promise<boolean> {
      return (await checkTrigger(options)) !== null;
    },
  };
}
