import type { IMastraLogger } from '../logger';
import type { AISpanRecord, MastraStorage } from '../storage';
import type { MastraScorer } from './base';
import { saveScorePayloadSchema, type ScoringEntityType } from './types';

export async function processTraceScoring({
  scorer,
  targets,
  storage,
  logger,
}: {
  scorer: MastraScorer;
  targets: { traceId: string; spanId?: string }[];
  storage: MastraStorage;
  logger?: IMastraLogger;
}) {
  for (const target of targets) {
    try {
      const trace = await storage.getAITrace(target.traceId);

      if (!trace) {
        logger?.warn(`Trace ${target.traceId} not found for scoring`);
        continue;
      }

      let span;
      if (target.spanId) {
        span = trace.spans.find(span => span.spanId === target.spanId);
      }

      const parentSpan = getParentSpan(trace.spans);
      let entityType;
      let entityId;
      let runPayload;
      if (parentSpan?.spanType === 'agent_run') {
        // const buildScoringInputForAgent
        console.log(`Skipping agent run ${parentSpan?.spanId}`);
        return;
      } else if (parentSpan?.spanType === 'workflow_run') {
        runPayload = span
          ? { input: span.input, output: span.output }
          : { input: parentSpan.input, output: parentSpan.output };
        entityType = 'WORKFLOW';
        entityId = parentSpan?.attributes?.workflowId;
        console.log('attributes', parentSpan?.attributes);
        console.log(`entityId ${entityId}`);
      }

      if (!runPayload) {
        throw new Error(`No run payload found for span ${parentSpan?.spanId}`);
      }

      // Run scorer
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

      await storage.saveScore(ValidatedSaveScorePayload);
    } catch (error) {
      console.error(`Failed to score trace ${target.traceId}:`, error);
    }
  }
}

function getParentSpan(spans: AISpanRecord[]) {
  return spans.find(span => span.parentSpanId === null);
}

// function buildScoringPayloadForAgent(spans: AISpanRecord[]): { input: ScorerRunInputForAgent, output: ScorerRunOutputForAgent } {
//     const parentSpan = getParentSpan(spans);
//     const llmGenerationSpan = spans.find((span) => span.spanType === 'llm_generation');
//     const inputMessages = parentSpan?.input?.messages || [];
//     const outputMessages = [parentSpan?.output || {}];

//     const systemMessages = []
//     const rememberedMessages = []
//     let workingMemory

//     for (let i = 0; i < (llmGenerationSpan?.input?.messages || []).length; i++) {
//         const message = (llmGenerationSpan?.input?.messages || [])[i];
//         if (message.role === 'system' && i === 0) {
//             systemMessages.push(message);
//         } else if (message.role === 'system') {
//             workingMemory = message;
//         } else if (message.role === 'user') {
//             rememberedMessages.push(message);
//         }
//     }

//     const output = outputMessages.map((message) => ({
//         role: message.role,
//         content: message.content,
//     }));

//     return {
//         input: {
//             inputMessages,
//             rememberedMessages,
//             systemMessages,
//             taggedSystemMessages: { systemMessages: [workingMemory] },
//         },
//         output,
//     };
// }
