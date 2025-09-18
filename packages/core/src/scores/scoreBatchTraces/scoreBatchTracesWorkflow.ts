import pMap from 'p-map';
import z from 'zod';
import { InternalSpans, type TracingContext } from '../../ai-tracing';
import type { AISpanRecord, AITraceRecord, MastraStorage } from '../../storage';
import { createStep, createWorkflow } from '../../workflows';
import type { ScorerRun } from '../base';
import { transformTraceToScorerInput, transformTraceToScorerOutput } from './transformer';
import type { ScoreRowData, ScoringEntityType } from '../types';
import { saveScorePayloadSchema } from '../types';

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
    scorerRunFormat: z.enum(['span', 'agent']).optional(),
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
    if (!scorer) {
      throw new Error('Scorer not found');
    }

    pMap(
      inputData.targets,
      async target => {
        const trace = await storage.getAITrace(target.traceId);

        if (!trace) {
          logger?.warn(`Trace ${target.traceId} not found for scoring`);
          return;
        }

        const parentSpan = trace.spans.find(span => span.parentSpanId === null);
        if (!parentSpan) {
          logger?.warn(`No parent span found for span ${target.spanId}`);
          return;
        }

        const span = trace.spans.find(span => span.spanId === target.spanId) ?? parentSpan;
        const entityType = getEntityType(parentSpan);
        if (!entityType) {
          logger?.warn(`No entity type found for span ${target.spanId}`);
          return;
        }
        const entityId = getEntityId(parentSpan);
        if (!entityId) {
          logger?.warn(`No entity id found for span ${target.spanId}`);
          return;
        }
        const scorerRun = buildScorerRun({
          scorerRunFormat: inputData.scorerRunFormat,
          tracingContext,
          trace,
          targetSpan: span,
        });

        let result;
        try {
          result = await scorer.run(scorerRun);
        } catch (error) {
          throw new Error(`Failed to run scorer ${scorer.name} for span ${parentSpan?.spanId}: ${error}`);
        }

        const traceId = `${target.traceId}-${target.spanId ?? parentSpan?.spanId}`;
        const scorerResult = {
          ...result,
          scorer: {
            id: scorer.name,
            name: scorer.name,
            description: scorer.description,
          },
          traceId,
          entityId,
          entityType: entityType as ScoringEntityType,
          entity: { id: entityId },
          source: 'TEST',
          scorerId: scorer.name,
        };

        const savedScoreRecord = await validateAndSaveScore({ storage, scorerResult });
        await attachScoreToSpan({ storage, span, scoreRecord: savedScoreRecord });
      },
      { concurrency: 3 },
    );
  },
});

function getEntityType(parentSpan: AISpanRecord) {
  if (parentSpan.spanType === 'agent_run') {
    return 'AGENT';
  } else if (parentSpan.spanType === 'workflow_run') {
    return 'WORKFLOW';
  }
}

function getEntityId(parentSpan: AISpanRecord) {
  if (parentSpan.spanType === 'agent_run') {
    return parentSpan?.attributes?.agentId;
  } else if (parentSpan.spanType === 'workflow_run') {
    return parentSpan?.attributes?.workflowId;
  }
}

async function validateAndSaveScore({ storage, scorerResult }: { storage: MastraStorage; scorerResult: ScorerRun }) {
  const payloadToSave = saveScorePayloadSchema.parse(scorerResult);
  const result = await storage?.saveScore(payloadToSave);
  return result.score;
}

function buildScorerRun({
  scorerRunFormat,
  tracingContext,
  trace,
  targetSpan,
}: {
  scorerRunFormat?: 'span' | 'agent';
  tracingContext: TracingContext;
  trace: AITraceRecord;
  targetSpan: AISpanRecord;
}) {
  let runPayload: ScorerRun;
  if (scorerRunFormat === 'agent') {
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
    scorerRunFormat: z.enum(['span', 'agent']).optional(),
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
