import pMap from 'p-map';
import z from 'zod';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import { InternalSpans, resolveObservabilityContext } from '../../observability';
import type { ObservabilityContext } from '../../observability';
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
  execute: async ({ inputData, mastra, ...rest }) => {
    const observabilityContext = resolveObservabilityContext(rest);
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
      logger?.error(mastraError.toString());
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
      logger?.error(mastraError.toString());
      logger?.trackException(mastraError);
      return;
    }

    await pMap(
      inputData.targets,
      async target => {
        try {
          await runScorerOnTarget({ storage, scorer, target, ...observabilityContext });
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
          logger?.error(mastraError.toString());
          logger?.trackException(mastraError);
        }
      },
      { concurrency: 3 },
    );
  },
});

export async function runScorerOnTarget({
  storage,
  scorer,
  target,
  ...observabilityContext
}: {
  storage: MastraStorage;
  scorer: MastraScorer;
  target: { traceId: string; spanId?: string };
} & Partial<ObservabilityContext>) {
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

  const scorerRun = buildScorerRun({
    scorerType: scorer.type === 'agent' ? 'agent' : undefined,
    ...observabilityContext,
    trace,
    targetSpan: span,
  });

  const result = await scorer.run(scorerRun);
  const scorerResult = {
    ...result,
    scorer: {
      id: scorer.id,
      name: scorer.name || scorer.id,
      description: scorer.description,
      hasJudge: !!scorer.judge,
    },
    traceId: target.traceId,
    spanId: target.spanId,
    entityId: span.entityId || span.entityName || 'unknown',
    entityType: span.spanType,
    entity: { traceId: span.traceId, spanId: span.spanId },
    source: 'TEST',
    scorerId: scorer.id,
  };

  const savedScoreRecord = await validateAndSaveScore({ storage, scorerResult });
  await attachScoreToSpan({ storage, span, scoreRecord: savedScoreRecord });
}

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
  ...observabilityContext
}: {
  scorerType?: string;
  trace: TraceRecord;
  targetSpan: SpanRecord;
} & Partial<ObservabilityContext>): ScorerRun {
  if (scorerType === 'agent') {
    const { input, output } = transformTraceToScorerInputAndOutput(trace);
    return { input, output, ...observabilityContext };
  }
  return { input: targetSpan.input, output: targetSpan.output, ...observabilityContext };
}

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
  const existingLinks = span.links || [];
  const link = {
    type: 'score',
    scoreId: scoreRecord.id,
    scorerName: scoreRecord.scorer.id,
    score: scoreRecord.score,
    createdAt: scoreRecord.createdAt,
  };
  await observabilityStore.updateSpan({
    spanId: span.spanId,
    traceId: span.traceId,
    updates: { links: [...existingLinks, link] },
  });
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
    tracingPolicy: {
      internal: InternalSpans.ALL,
    },
    validateInputs: false,
  },
});

scoreTracesWorkflow.then(getTraceStep).commit();
