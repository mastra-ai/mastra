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
          await scoreTrace({ storage, scorer, target });
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

export type ScoreTraceTarget = { traceId: string; spanId?: string } | { trace: TraceRecord; spanId?: string };

export type ScoreTraceBatchTarget = {
  traceId: string;
  spanId?: string;
  datasetItemId?: string;
};

export type ScoreTraceBatchResult =
  | {
      ok: true;
      index: number;
      traceId: string;
      spanId: string;
      datasetItemId?: string;
      score: ScoreRowData;
    }
  | {
      ok: false;
      index: number;
      traceId: string;
      spanId?: string;
      datasetItemId?: string;
      error: Error;
    };

type ScoreTraceReferenceTarget = { traceId: string; spanId?: string };

function isScoreTraceReferenceTarget(target: ScoreTraceTarget): target is ScoreTraceReferenceTarget {
  return 'traceId' in target;
}

function resolveTargetSpan({ trace, spanId }: { trace: TraceRecord; spanId?: string }): SpanRecord {
  const span = spanId
    ? trace.spans.find(candidateSpan => candidateSpan.spanId === spanId)
    : trace.spans.find(candidateSpan => candidateSpan.parentSpanId === null);

  if (!span) {
    throw new Error(`Span not found for scoring, traceId: ${trace.traceId}, spanId: ${spanId ?? 'Not provided'}`);
  }

  return span;
}

/** Resolve the target span for a trace/target pair. */
async function resolveTraceAndSpan({
  storage,
  target,
}: {
  storage: MastraStorage;
  target: ScoreTraceTarget;
}): Promise<{ trace: TraceRecord; span: SpanRecord }> {
  if (!isScoreTraceReferenceTarget(target)) {
    return {
      trace: target.trace,
      span: resolveTargetSpan({ trace: target.trace, spanId: target.spanId }),
    };
  }

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

  return { trace, span: resolveTargetSpan({ trace, spanId: target.spanId }) };
}

type TraceScoreResult = Awaited<ReturnType<MastraScorer['run']>>;

/**
 * Run a scorer against an already-resolved trace + span.
 *
 * Span tenancy (`organizationId`, `resourceId` → `projectId`) is threaded into
 * the scorer run so any score the scorer emits is correctly multi-tenant.
 */
async function runScorerForTrace({
  scorer,
  trace,
  span,
}: {
  scorer: MastraScorer;
  trace: TraceRecord;
  span: SpanRecord;
}): Promise<TraceScoreResult> {
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
 * Resolve a trace/span target, run the scorer, and persist the resulting score.
 */
export async function scoreTrace({
  storage,
  scorer,
  target,
  batchId,
  datasetId,
  datasetItemId,
}: {
  storage: MastraStorage;
  scorer: MastraScorer;
  target: ScoreTraceTarget;
  /** Optional batch handle stamped on the persisted score so all scores from one
   * batch scoring call share a `batchId` (each keeps its own per-execution `runId`). */
  batchId?: string;
  /** Optional dataset provenance stamped on the persisted score so baseline scores
   * can join back to the curated dataset item that produced them. Top-level handles,
   * independent of how the trace is resolved. */
  datasetId?: string;
  datasetItemId?: string;
}): Promise<ScoreRowData> {
  const { trace, span } = await resolveTraceAndSpan({ storage, target });
  const tenancy = getSpanTenancy(span);

  const result = await runScorerForTrace({ scorer, trace, span });

  const scorerResult = {
    ...result,
    scorer: {
      id: scorer.id,
      name: scorer.name || scorer.id,
      description: scorer.description,
      hasJudge: !!scorer.judge,
    },
    traceId: trace.traceId,
    spanId: span.spanId,
    entityId: span.entityId || span.entityName || 'unknown',
    entityType: span.spanType,
    entity: { traceId: span.traceId, spanId: span.spanId },
    source: 'TEST',
    scorerId: scorer.id,
    ...(tenancy.organizationId ? { organizationId: tenancy.organizationId } : {}),
    ...(tenancy.projectId ? { projectId: tenancy.projectId } : {}),
    ...(batchId ? { batchId } : {}),
    ...(datasetId ? { datasetId } : {}),
    ...(datasetItemId ? { datasetItemId } : {}),
  };

  // Legacy score-store emission. This path is being deprecated.
  const savedScoreRecord = await validateAndSaveScore({ storage, scorerResult });
  await attachScoreToSpan({ storage, span, scoreRecord: savedScoreRecord });
  return savedScoreRecord;
}

function toBatchResultError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === 'string' ? error : 'Unknown scoreTraceBatch error');
}

export async function scoreTraceBatch({
  storage,
  scorer,
  targets,
  batchId,
  datasetId,
  concurrency = 3,
}: {
  storage: MastraStorage;
  scorer: MastraScorer;
  targets: ScoreTraceBatchTarget[];
  batchId?: string;
  datasetId?: string;
  concurrency?: number;
}): Promise<{
  batchId?: string;
  datasetId?: string;
  scoredCount: number;
  failedCount: number;
  results: ScoreTraceBatchResult[];
}> {
  const results = await pMap(
    targets,
    async (target, index): Promise<ScoreTraceBatchResult> => {
      try {
        const score = await scoreTrace({
          storage,
          scorer,
          target,
          batchId,
          datasetId,
          datasetItemId: target.datasetItemId,
        });
        const spanId = score.spanId ?? target.spanId;

        if (!spanId) {
          throw new Error(`Persisted score is missing spanId for traceId: ${target.traceId}`);
        }

        return {
          ok: true,
          index,
          traceId: score.traceId ?? target.traceId,
          spanId,
          ...(target.datasetItemId ? { datasetItemId: target.datasetItemId } : {}),
          score,
        };
      } catch (error) {
        return {
          ok: false,
          index,
          traceId: target.traceId,
          ...(target.spanId ? { spanId: target.spanId } : {}),
          ...(target.datasetItemId ? { datasetItemId: target.datasetItemId } : {}),
          error: toBatchResultError(error),
        };
      }
    },
    { concurrency },
  );

  const scoredCount = results.filter(result => result.ok).length;

  return {
    ...(batchId ? { batchId } : {}),
    ...(datasetId ? { datasetId } : {}),
    scoredCount,
    failedCount: results.length - scoredCount,
    results,
  };
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

function buildScorerRun({
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
