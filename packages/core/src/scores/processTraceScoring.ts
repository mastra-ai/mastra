import z from 'zod';
import { InternalSpans } from '../ai-tracing';
import type { Mastra } from '../mastra';
import { MastraStorage, type AISpanRecord } from '../storage';
import { createStep, createWorkflow } from '../workflows';
import type { MastraScorer } from './base';
import { saveScorePayloadSchema } from './types';
import type { ScoringEntityType } from './types';
import pMap from 'p-map';

export async function processTraceScoring({
  scorerName,
  targets,
  mastra,
}: {
  scorerName: string;
  targets: { traceId: string; spanId?: string }[];
  mastra: Mastra;
}) {
  const workflow = mastra.__getInternalWorkflow('__batch-scoring-traces');
  const run = await workflow.createRunAsync();

  const result = await run.start({ inputData: { targets, scorerName } });

  console.log(JSON.stringify(result, null, 2));
}

function getParentSpan(spans: AISpanRecord[]) {
  return spans.find(span => span.parentSpanId === null);
}

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
    const logger = mastra.getLogger();
    const scorer = mastra.getScorerByName(inputData.scorerName);

    if (!storage) {
      throw new Error('Storage not found');
    }

    if (!logger) {
      throw new Error('Logger not found');
    }

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

        let span;
        if (target.spanId) {
          span = trace.spans.find(span => span.spanId === target.spanId);
        }

        const parentSpan = getParentSpan(trace.spans);

        if (!parentSpan) {
          throw new Error(`No parent span found for span ${target.spanId}`);
        }

        let entityType;
        let entityId;
        let runPayload;
        if (parentSpan?.spanType === 'agent_run') {
          runPayload = span
            ? { input: span.input, output: span.output }
            : { input: parentSpan.input, output: parentSpan.output };
          entityType = 'AGENT';
          entityId = parentSpan?.attributes?.agentId;
        } else if (parentSpan?.spanType === 'workflow_run') {
          runPayload = span
            ? { input: span.input, output: span.output }
            : { input: parentSpan.input, output: parentSpan.output };
          entityType = 'WORKFLOW';
          entityId = parentSpan?.attributes?.workflowId;
        }

        if (!runPayload) {
          throw new Error(`No run payload found for span ${parentSpan?.spanId}`);
        }

        // @ts-ignore
        runPayload.tracingContext = tracingContext;

        const result = await scorer.run(runPayload);
        const traceId = `${target.traceId}-${target.spanId ?? parentSpan?.spanId}`;

        const ValidatedSaveScorePayload = saveScorePayloadSchema.parse({
          scorer: {
            id: scorer.name,
            name: scorer.name,
            description: scorer.description,
          },
          ...result,
          traceId,
          entityId,
          entityType: entityType as ScoringEntityType,
          entity: { id: entityId },
          source: 'TEST',
          scorerId: scorer.name,
        });

        const savedScore = await storage.saveScore(ValidatedSaveScorePayload);

        if (span) {
          const existingLinks = span.links || [];
          span.links = [
            ...existingLinks,
            // TODO: implement an api to get scores based on traceId and spanId for frontend
            {
              type: 'score',
              scoreId: savedScore.score.id,
              scorerName: savedScore.score.scorer.name,
              score: savedScore.score.score,
              createdAt: savedScore.score.createdAt,
            },
          ];
          await storage.updateAISpan({ spanId: span.spanId, traceId: span.traceId, updates: { links: span.links } });
        } else {
          const existingLinks = parentSpan.links || [];
          parentSpan.links = [
            ...existingLinks,
            // TODO: implement an api to get scores based on traceId and spanId for frontend
            {
              type: 'score',
              scoreId: savedScore.score.id,
              scorerName: savedScore.score.scorer.name,
              score: savedScore.score.score,
              createdAt: savedScore.score.createdAt,
            },
          ];
          await storage.updateAISpan({
            spanId: parentSpan.spanId,
            traceId: parentSpan.traceId,
            updates: { links: parentSpan.links },
          });
        }
      },
      { concurrency: 1 },
    );
  },
});

export const processTraceScoringWorkflow = createWorkflow({
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

processTraceScoringWorkflow.then(getTraceStep).commit();
