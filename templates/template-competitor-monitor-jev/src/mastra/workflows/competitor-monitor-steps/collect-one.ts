import { createStep } from '@mastra/core/workflows';

import { CompletedAcquisitionError, processSource } from '../source-processing';
import { errorDetails, sourceTaskSchema, sourceProcessedSchema, type StepContext } from './workflow-context';

export function createCollectOneStep(context: StepContext) {
  const { dependencies, sourceLimiter } = context;
  return createStep({
    id: 'collect-one-competitor-source',
    description: 'Collects one validated public source and atomically persists its snapshot, evidence, and outcome.',
    inputSchema: sourceTaskSchema,
    outputSchema: sourceProcessedSchema,
    execute: async ({ inputData, abortSignal }) => {
      try {
        const processed = await sourceLimiter.run(
          inputData.runId,
          inputData.input.policy.sourceConcurrency ?? dependencies.config.sources.concurrency,
          () => processSource(inputData.input, inputData.runId, inputData.source, dependencies, abortSignal),
        );
        return {
          ...processed,
          runId: inputData.runId,
          monitorId: inputData.input.monitorId,
          sourceId: inputData.source.id,
        };
      } catch (error) {
        if (abortSignal.aborted) throw error;
        const detail = errorDetails(error);
        await dependencies.store.recordSourceOutcome(
          inputData.runId,
          inputData.source.id,
          /QUARANTINED|QUALITY|LANGUAGE/.test(detail.code) ? 'quarantined' : 'failed',
          detail,
        );
        return {
          runId: inputData.runId,
          monitorId: inputData.input.monitorId,
          sourceId: inputData.source.id,
          source: {
            sourceId: inputData.source.id,
            status: 'failed' as const,
            acquisitionCompleted: error instanceof CompletedAcquisitionError,
            error: detail,
          },
        };
      }
    },
  });
}
