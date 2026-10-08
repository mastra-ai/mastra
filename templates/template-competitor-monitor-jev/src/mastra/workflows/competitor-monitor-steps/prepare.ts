import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { monitorInputSchema, validateMonitorInput } from '../../schemas';
import { sourceTaskSchema, validateEffectiveLimits, type StepContext } from './workflow-context';

export function createPrepareStep(context: StepContext) {
  const { dependencies, finishCanceledRun } = context;
  return createStep({
    id: 'prepare-competitor-sources',
    description:
      'Validates a monitor invocation, obtains its same-monitor lock, and prepares bounded source work items.',
    inputSchema: monitorInputSchema,
    outputSchema: z.array(sourceTaskSchema),
    execute: async ({ inputData, abortSignal, runId }) => {
      const input = validateMonitorInput(inputData);
      validateEffectiveLimits(input, dependencies.config);
      const run = await dependencies.store.beginRun(input.monitorId, runId);
      const cleanUpCancellation = () => finishCanceledRun(run.id, run.monitorId);

      if (abortSignal.aborted) {
        await cleanUpCancellation();
        throw abortSignal.reason;
      }

      abortSignal.addEventListener(
        'abort',
        () => {
          void cleanUpCancellation().catch(() => {});
        },
        { once: true },
      );

      return input.sources.map(source => ({ runId: run.id, input, source }));
    },
  });
}
