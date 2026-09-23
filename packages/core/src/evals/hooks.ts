import { createHash } from 'node:crypto';
import { AvailableHooks, executeHook } from '../hooks';
import { setScorerHookOwner } from '../hooks/scorer-owner';
import type { Mastra } from '../mastra';
import type { ObservabilityContext } from '../observability';
import type { MastraScorerEntry } from './base';
import { evaluateScoringPredicate } from './predicate';
import { snapshotRequestContextForScore } from './request-context-snapshot';
import type { ScoringEntityType, ScoringHookInput, ScoringSource } from './types';

/**
 * Maps a key to a stable value in [0, 1) for sampling decisions.
 *
 * Uses sha256 so the distribution is uniform across the realistic key space (hex trace IDs,
 * UUID run IDs) rather than only for synthetic sequential inputs. Reads 6 bytes (48 bits) —
 * well within the 53-bit integer range, so no precision loss.
 */
export function hashToUnitInterval(key: string): number {
  const digest = createHash('sha256').update(key).digest();
  return Number(digest.readUIntBE(0, 6)) / 2 ** 48;
}

export function runScorer({
  runId,
  scorerId,
  scorerObject,
  input,
  output,
  requestContext,
  entity,
  structuredOutput,
  source,
  entityType,
  threadId,
  resourceId,
  projectId,
  mastra,
  ...observabilityContext
}: {
  scorerId: string;
  scorerObject: MastraScorerEntry;
  runId: string;
  input: any;
  output: any;
  requestContext: Record<string, any>;
  entity: Record<string, any>;
  structuredOutput: boolean;
  source: ScoringSource;
  entityType: ScoringEntityType;
  threadId?: string;
  resourceId?: string;
  projectId?: string;
  mastra?: Mastra;
} & ObservabilityContext) {
  const currentSpan = observabilityContext.tracing?.currentSpan;

  // The tracer already declined this trace, so the span is a NoOpSpan and nothing about this
  // trace was stored. Scoring it would emit a score pointing at a traceId that cannot be
  // drilled into. Checked explicitly against `false`: an absent span means observability is
  // not configured at all, which is not a decline and must still score.
  if (currentSpan?.isValid === false) {
    return;
  }

  const safeContext: Record<string, any> = snapshotRequestContextForScore(requestContext);

  // Eligibility filter runs before sampling (filter → sample), so the sampling
  // rate applies to qualifying traffic only. It evaluates against the same
  // flattened requestContext that gets persisted on score rows, so a filter is
  // answerable later against stored records. Fail closed: an invalid filter
  // skips scoring rather than scoring everything.
  if (scorerObject?.filter) {
    let qualifies = false;
    try {
      qualifies = evaluateScoringPredicate(scorerObject.filter, {
        requestContext: safeContext,
        entity,
        entityType,
        source,
        threadId,
        resourceId,
        projectId,
      });
    } catch (error) {
      mastra?.getLogger?.()?.warn?.('Scoring filter evaluation failed; skipping scoring', { scorerId, runId, error });
    }
    if (!qualifies) {
      return;
    }
  }

  let shouldExecute = false;

  if (!scorerObject?.sampling || scorerObject?.sampling?.type === 'none') {
    shouldExecute = true;
  }

  if (scorerObject?.sampling?.type) {
    switch (scorerObject?.sampling?.type) {
      case 'ratio': {
        // Key on the trace so that every scorer at a given rate selects the same traces,
        // making scores on sampled traffic comparable across scorers. Falls back to runId
        // when untraced so the decision stays reproducible without observability configured.
        // Safe to read traceId here only because declined spans returned above — a NoOpSpan's
        // traceId is a shared constant and would collapse the whole declined population into
        // one all-or-nothing decision.
        const samplingKey = currentSpan?.traceId ?? runId;
        shouldExecute = hashToUnitInterval(samplingKey) < scorerObject?.sampling?.rate;
        break;
      }
      case 'none':
        shouldExecute = true;
        break;
      default:
        // Fail closed. An unrecognized sampling type most likely means config
        // written by a newer version (or a serialization round-trip that
        // dropped fields) — scoring 100% of traffic on bad config is the
        // wrong surprise.
        shouldExecute = false;
    }
  }

  if (!shouldExecute) {
    return;
  }

  const payload: ScoringHookInput = {
    scorer: {
      id: scorerObject.scorer?.id || scorerId,
      name: scorerObject.scorer?.name,
      description: scorerObject.scorer.description,
    },
    input,
    output,
    requestContext: safeContext,
    runId,
    source,
    entity,
    structuredOutput,
    entityType,
    threadId,
    resourceId,
    projectId,
    ...observabilityContext,
  };

  setScorerHookOwner(payload, mastra);
  executeHook(AvailableHooks.ON_SCORER_RUN, payload);
}
