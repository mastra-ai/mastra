import z from 'zod';
import { InternalSpans } from '../ai-tracing';
import type { Mastra } from '../mastra';
import type { AISpanRecord } from '../storage';
import { createStep, createWorkflow } from '../workflows';
import type { MastraScorer } from './base';
import { saveScorePayloadSchema } from './types';
import type { ScoringEntityType } from './types';

export async function processTraceScoring({
  scorer,
  targets,
  mastra,
}: {
  scorer: MastraScorer;
  targets: { traceId: string; spanId?: string }[];
  mastra: Mastra;
}) {
  const workflow = createScoringWorkflow({ scorer, mastra });
  const run = await workflow.createRunAsync();

  const result = await run.start({ inputData: targets });

  console.log(JSON.stringify(result, null, 2));
}

function getParentSpan(spans: AISpanRecord[]) {
  return spans.find(span => span.parentSpanId === null);
}

const createScoringWorkflow = ({ scorer, mastra }: { scorer: MastraScorer; mastra: Mastra }) => {
  const storage = mastra.getStorage();
  const logger = mastra.getLogger();

  if (!storage) {
    throw new Error('Storage not found');
  }

  if (!logger) {
    throw new Error('Logger not found');
  }

  const getTraceStep = createStep({
    id: 'process-trace-scoring',
    inputSchema: z.object({
      traceId: z.string(),
      spanId: z.string().optional(),
    }),
    outputSchema: z.any(),
    execute: async ({ inputData, tracingContext }) => {
      const trace = await storage.getAITrace(inputData.traceId);

      if (!trace) {
        logger?.warn(`Trace ${inputData.traceId} not found for scoring`);
        return;
      }

      let span;
      if (inputData.spanId) {
        span = trace.spans.find(span => span.spanId === inputData.spanId);
      }

      const parentSpan = getParentSpan(trace.spans);

      if (!parentSpan) {
        throw new Error(`No parent span found for span ${inputData.spanId}`);
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
      const traceId = `${inputData.traceId}-${inputData.spanId ?? parentSpan?.spanId}`;

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
  });

  const workflow = createWorkflow({
    id: 'process-trace-scoring',
    inputSchema: z.array(
      z.object({
        traceId: z.string(),
        spanId: z.string().optional(),
      }),
    ),
    outputSchema: z.any(),
    steps: [getTraceStep],
    options: {
      tracingPolicy: {
        internal: InternalSpans.ALL,
      },
    },
  });

  workflow.foreach(getTraceStep, { concurrency: 1 }).commit();

  return workflow;
};
