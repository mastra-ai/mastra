import pMap from 'p-map';
import z from 'zod';
import { InternalSpans, type TracingContext } from '../../ai-tracing';
import type { AISpanRecord, AITraceRecord, MastraStorage } from '../../storage';
import { createStep, createWorkflow } from '../../workflows/evented';
import type { MastraScorer, ScorerRun } from '../base';
import { transformTraceToScorerInput, transformTraceToScorerOutput } from './transformer';
import type { ScoreRowData, ScoringEntityType } from '../types';
import { saveScorePayloadSchema } from '../types';
import type { IMastraLogger } from '../../logger';

const getTraceStep = createStep({
  id: '__process-trace-scoring',
  inputSchema: z.object({
    targets: z.array(
      z.object({
        traceId: z.string(),
        spanId: z.string().optional(),
      }),
    ),
    scorerName: z.string(),
  }),
  outputSchema: z.any(),
  execute: async ({ inputData, tracingContext, mastra }) => {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new Error('Storage not found');
    }

    const logger = mastra.getLogger();
    if (!logger) {
      throw new Error('Logger not found');
    }

    const scorer = mastra.getScorerByName(inputData.scorerName);
    await batchRunScorersOnTargets({ storage, logger, scorer, targets: inputData.targets, tracingContext });
  },
});

async function batchRunScorersOnTargets({
  storage,
  logger,
  scorer,
  targets,
  tracingContext,
}: {
  storage: MastraStorage;
  logger: IMastraLogger;
  scorer: MastraScorer;
  targets: { traceId: string; spanId?: string }[];
  tracingContext: TracingContext;
}) {
  pMap(
    targets,
    async target => {
      try {
        await runScorerOnTarget({ storage, logger, scorer, target, tracingContext });
      } catch (error) {
        logger?.error(`Failed to save score for trace ${target.traceId} and span ${target.spanId}: ${error}`);
      }
    },
    { concurrency: 3 },
  );
}

async function runScorerOnTarget({
  storage,
  logger,
  scorer,
  target,
  tracingContext,
}: {
  storage: MastraStorage;
  logger: IMastraLogger;
  scorer: MastraScorer;
  target: { traceId: string; spanId?: string };
  tracingContext: TracingContext;
}) {
  // TODO: add storage api to get a single span
  const trace = await storage.getAITrace(target.traceId);

  if (!trace) {
    logger?.warn(`Trace ${target.traceId} not found for scoring`);
    return;
  }

  let span: AISpanRecord | undefined;
  if (target.spanId) {
    span = trace.spans.find(span => span.spanId === target.spanId);
  } else {
    span = trace.spans.find(span => span.parentSpanId === null);
  }

  if (!span) {
    logger?.warn(`No span found for span ${target.spanId}`);
    return;
  }

  const scorerRun = buildScorerRun({
    scorerType: scorer.type === 'agent' ? 'agent' : undefined,
    tracingContext,
    trace,
    targetSpan: span,
  });

  let result;
  try {
    result = await scorer.run(scorerRun);
  } catch (error) {
    throw new Error(`Failed to run scorer ${scorer.name} for span ${span.spanId}: ${error}`);
  }

  const traceId = `${target.traceId}${target.spanId ? `-${target.spanId}` : ''}`;
  const scorerResult = {
    ...result,
    scorer: {
      id: scorer.name,
      name: scorer.name,
      description: scorer.description,
    },
    traceId,
    entityId: span.name,
    entityType: span.spanType,
    entity: { traceId: span.traceId, spanId: span.spanId },
    source: 'TEST',
    scorerId: scorer.name,
  };

  const savedScoreRecord = await validateAndSaveScore({ storage, scorerResult });
  await attachScoreToSpan({ storage, span, scoreRecord: savedScoreRecord });
}

async function validateAndSaveScore({ storage, scorerResult }: { storage: MastraStorage; scorerResult: ScorerRun }) {
  const payloadToSave = saveScorePayloadSchema.parse(scorerResult);
  const result = await storage?.saveScore(payloadToSave);
  return result.score;
}

function buildScorerRun({
  scorerType,
  tracingContext,
  trace,
  targetSpan,
}: {
  scorerType?: string;
  tracingContext: TracingContext;
  trace: AITraceRecord;
  targetSpan: AISpanRecord;
}) {
  let runPayload: ScorerRun;
  if (scorerType === 'agent') {
    runPayload = {
      input: transformTraceToScorerInput(trace as any),
      output: transformTraceToScorerOutput(trace as any),
    };
  } else {
    runPayload = { input: targetSpan.input, output: targetSpan.output };
  }

  runPayload.tracingContext = tracingContext;
  return runPayload;
}

async function attachScoreToSpan({
  storage,
  span,
  scoreRecord,
}: {
  storage: MastraStorage;
  span: AISpanRecord;
  scoreRecord: ScoreRowData;
}) {
  const existingLinks = span.links || [];
  const link = {
    type: 'score',
    scoreId: scoreRecord.id,
    scorerName: scoreRecord.scorer.name,
    score: scoreRecord.score,
    createdAt: scoreRecord.createdAt,
  };
  await storage.updateAISpan({
    spanId: span.spanId,
    traceId: span.traceId,
    updates: { links: [...existingLinks, link] },
  });
}

export const scoreBatchTracesWorkflow = createWorkflow({
  id: '__batch-scoring-traces',
  inputSchema: z.object({
    targets: z.array(
      z.object({
        traceId: z.string(),
        spanId: z.string().optional(),
      }),
    ),
    scorerName: z.string(),
  }),
  outputSchema: z.any(),
  steps: [getTraceStep],
  options: {
    tracingPolicy: {
      internal: InternalSpans.ALL,
    },
  },
});

scoreBatchTracesWorkflow.then(getTraceStep).commit();
