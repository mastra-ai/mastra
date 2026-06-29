import pMap from 'p-map';
import { z } from 'zod/v4';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import { getEntityTypeForSpan, InternalSpans } from '../../observability';
import type { SpanRecord, TraceRecord, MastraStorage } from '../../storage';
import { createStep, createWorkflow } from '../../workflows/evented';
import type { MastraScorer, ScorerRun } from '../base';
import type { ScoreRowData } from '../types';
import { saveScorePayloadSchema } from '../types';
import { transformTraceToScorerInputAndOutput } from './utils';

const getTraceStep = createStep({
  id: '__process-trace-scoring',
  inputSchema: z.object({
    targets: z.array(
      z.object({
        traceId: z.string(),
        spanId: z.string().optional(),
      }),
    ),
    scorerId: z.string(),
  }),
  outputSchema: z.any(),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra.getLogger();
    if (!logger) {
      console.warn(
        '[scoreTracesWorkflow] Logger not initialized: no debug or error logs will be recorded for scoring traces.',
      );
    }

    const storage = mastra.getStorage();
    if (!storage) {
      const mastraError = new MastraError({
        id: 'MASTRA_STORAGE_NOT_FOUND_FOR_TRACE_SCORING',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Storage not found for trace scoring',
        details: {
          scorerId: inputData.scorerId,
        },
      });
      logger?.trackException(mastraError);
      return;
    }

    let scorer: MastraScorer | undefined;
    try {
      scorer = mastra.getScorerById(inputData.scorerId);
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_SCORER_NOT_FOUND_FOR_TRACE_SCORING',
          domain: ErrorDomain.SCORER,
          category: ErrorCategory.SYSTEM,
          text: `Scorer not found for trace scoring`,
          details: {
            scorerId: inputData.scorerId,
          },
        },
        error,
      );
      logger?.trackException(mastraError);
      return;
    }

    await pMap(
      inputData.targets,
      async target => {
        try {
          await runScorerOnTarget({ storage, scorer, target });
        } catch (error) {
          const mastraError = new MastraError(
            {
              id: 'MASTRA_SCORER_FAILED_TO_RUN_SCORER_ON_TRACE',
              domain: ErrorDomain.SCORER,
              category: ErrorCategory.SYSTEM,
              details: {
                scorerId: scorer.id,
                spanId: target.spanId || '',
                traceId: target.traceId,
              },
            },
            error,
          );
          logger?.trackException(mastraError);
        }
      },
      { concurrency: 3 },
    );
  },
});

/** Tenancy derived from a span, threaded into emitted scores. */
type ScoreTenancy = {
  organizationId?: string;
  projectId?: string;
};

/**
 * Derive score tenancy from a span. On spans, `resourceId` carries the project
 * scope, so it maps to the score's `projectId` field.
 */
function getSpanTenancy(span: SpanRecord): ScoreTenancy {
  const tenancy: ScoreTenancy = {};
  if (span.organizationId) {
    tenancy.organizationId = span.organizationId;
  }
  if (span.resourceId) {
    tenancy.projectId = span.resourceId;
  }
  return tenancy;
}

/** Resolve the target span for a trace/target pair. */
async function resolveTraceAndSpan({
  storage,
  target,
}: {
  storage: MastraStorage;
  target: { traceId: string; spanId?: string };
}): Promise<{ trace: TraceRecord; span: SpanRecord }> {
  // TODO: add storage api to get a single span
  const observabilityStore = await storage.getStore('observability');
  if (!observabilityStore) {
    throw new MastraError({
      id: 'MASTRA_OBSERVABILITY_STORAGE_NOT_AVAILABLE',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: 'Observability storage domain is not available',
    });
  }
  const trace = await observabilityStore.getTrace({ traceId: target.traceId });
  if (!trace) {
    throw new Error(`Trace not found for scoring, traceId: ${target.traceId}`);
  }

  let span: SpanRecord | undefined;
  if (target.spanId) {
    span = trace.spans.find(span => span.spanId === target.spanId);
  } else {
    span = trace.spans.find(span => span.parentSpanId === null);
  }

  if (!span) {
    throw new Error(
      `Span not found for scoring, traceId: ${target.traceId}, spanId: ${target.spanId ?? 'Not provided'}`,
    );
  }

  return { trace, span };
}

/** Full result returned by {@link scoreTarget} / {@link scoreTargets}. */
export type ScoreTargetResult = Awaited<ReturnType<MastraScorer['run']>>;

/**
 * Run a scorer against an already-resolved trace + span and return the scorer
 * result. Does NOT persist to the scores store — callers that want to return
 * score/reason in an HTTP response (e.g. ad-hoc/per-candidate scorers) use this.
 *
 * Span tenancy (`organizationId`, `resourceId` → `projectId`) is threaded into
 * the scorer run so any score the scorer emits is correctly multi-tenant.
 */
export async function scoreTarget({
  scorer,
  trace,
  span,
}: {
  scorer: MastraScorer;
  trace: TraceRecord;
  span: SpanRecord;
}): Promise<ScoreTargetResult> {
  const tenancy = getSpanTenancy(span);

  const scorerRun = buildScorerRun({
    scorerType: scorer.type === 'agent' ? 'agent' : undefined,
    trace,
    targetSpan: span,
  });

  return scorer.run({
    ...scorerRun,
    scoreSource: 'trace',
    targetScope: 'span',
    targetEntityType: getEntityTypeForSpan(span),
    targetTraceId: trace.traceId,
    targetSpanId: span.spanId,
    targetCorrelationContext: {
      traceId: trace.traceId,
      spanId: span.spanId,
      ...(tenancy.organizationId ? { organizationId: tenancy.organizationId } : {}),
      ...(tenancy.projectId ? { resourceId: tenancy.projectId } : {}),
    },
    targetMetadata: {
      ...(tenancy.organizationId ? { organizationId: tenancy.organizationId } : {}),
      ...(tenancy.projectId ? { projectId: tenancy.projectId } : {}),
    },
  });
}

/**
 * Resolve each target's trace/span from storage and run the scorer, returning
 * the scorer results WITHOUT persisting them. Throws on the first failure so
 * callers can surface errors in their response.
 */
export async function scoreTargets({
  storage,
  scorer,
  targets,
  concurrency = 3,
}: {
  storage: MastraStorage;
  scorer: MastraScorer;
  targets: { traceId: string; spanId?: string }[];
  concurrency?: number;
}): Promise<ScoreTargetResult[]> {
  return pMap(
    targets,
    async target => {
      const { trace, span } = await resolveTraceAndSpan({ storage, target });
      return scoreTarget({ scorer, trace, span });
    },
    { concurrency },
  );
}

export async function runScorerOnTarget({
  storage,
  scorer,
  target,
  batchId,
}: {
  storage: MastraStorage;
  scorer: MastraScorer;
  target: { traceId: string; spanId?: string };
  /** Optional batch handle stamped on the persisted score so all scores from one
   * batch scoring call share a `batchId` (each keeps its own per-execution `runId`). */
  batchId?: string;
}) {
  const { trace, span } = await resolveTraceAndSpan({ storage, target });
  const tenancy = getSpanTenancy(span);

  const result = await scoreTarget({ scorer, trace, span });

  const scorerResult = {
    ...result,
    scorer: {
      id: scorer.id,
      name: scorer.name || scorer.id,
      description: scorer.description,
      hasJudge: !!scorer.judge,
    },
    traceId: target.traceId,
    spanId: span.spanId,
    entityId: span.entityId || span.entityName || 'unknown',
    entityType: span.spanType,
    entity: { traceId: span.traceId, spanId: span.spanId },
    source: 'TEST',
    scorerId: scorer.id,
    ...(tenancy.organizationId ? { organizationId: tenancy.organizationId } : {}),
    ...(tenancy.projectId ? { projectId: tenancy.projectId } : {}),
    ...(batchId ? { batchId } : {}),
  };

  // Legacy score-store emission. This path is being deprecated.
  const savedScoreRecord = await validateAndSaveScore({ storage, scorerResult });
  await attachScoreToSpan({ storage, span, scoreRecord: savedScoreRecord });
}

/**
 * @deprecated Legacy scores-store path. New score emission should use `mastra.observability.addScore()`.
 */
async function validateAndSaveScore({ storage, scorerResult }: { storage: MastraStorage; scorerResult: ScorerRun }) {
  const scoresStore = await storage.getStore('scores');
  if (!scoresStore) {
    throw new MastraError({
      id: 'MASTRA_SCORES_STORAGE_NOT_AVAILABLE',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: 'Scores storage domain is not available',
    });
  }
  const payloadToSave = saveScorePayloadSchema.parse(scorerResult);
  const result = await scoresStore.saveScore(payloadToSave);
  return result.score;
}

export function buildScorerRun({
  scorerType,
  trace,
  targetSpan,
}: {
  scorerType?: string;
  trace: TraceRecord;
  targetSpan: SpanRecord;
}): ScorerRun {
  if (scorerType === 'agent') {
    const { input, output } = transformTraceToScorerInputAndOutput(trace);
    return { input, output };
  }
  return { input: targetSpan.input, output: targetSpan.output };
}

/**
 * @deprecated Legacy score-attach path. New score emission should use `mastra.observability.addScore()`
 * which autmatically attach scores to spans.
 */
async function attachScoreToSpan({
  storage,
  span,
  scoreRecord,
}: {
  storage: MastraStorage;
  span: SpanRecord;
  scoreRecord: ScoreRowData;
}) {
  const observabilityStore = await storage.getStore('observability');
  if (!observabilityStore) {
    throw new MastraError({
      id: 'MASTRA_OBSERVABILITY_STORAGE_NOT_AVAILABLE',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: 'Observability storage domain is not available',
    });
  }

  // Path 1: Legacy — attach score link to span
  try {
    const existingLinks = span.links || [];
    const link = {
      type: 'score',
      scoreId: scoreRecord.id,
      scorerId: scoreRecord.scorerId ?? scoreRecord.scorer?.id,
      score: scoreRecord.score,
      createdAt: scoreRecord.createdAt,
    };
    await observabilityStore.updateSpan({
      spanId: span.spanId,
      traceId: span.traceId,
      updates: { links: [...existingLinks, link] },
    });
  } catch {
    // Expected for event-sourced stores (e.g. DuckDB) that don't support updateSpan
  }
}

export const scoreTracesWorkflow = createWorkflow({
  id: '__batch-scoring-traces',
  inputSchema: z.object({
    targets: z.array(
      z.object({
        traceId: z.string(),
        spanId: z.string().optional(),
      }),
    ),
    scorerId: z.string(),
  }),
  outputSchema: z.any(),
  steps: [getTraceStep],
  options: {
    validateInputs: false,
    // Internal batch-scoring plumbing — hide its workflow spans from exported
    // traces. Any user-facing work invoked from steps (e.g. the scorer's own
    // SCORER_RUN span) keeps its own policy and remains visible.
    tracingPolicy: {
      internal: InternalSpans.WORKFLOW,
    },
  },
});

scoreTracesWorkflow.then(getTraceStep).commit();
