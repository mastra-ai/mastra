import { rehydrateDraftRun } from './prepare.ts';
import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { questionResultSchema } from '../../../contracts/answer.ts';
import { flagInconsistentAnswers } from '../../../processing/consistency.ts';
import { ProcessingFailure } from '../../../processing/failure.ts';
import { draftInputSchema, draftOutputSchema } from '../contracts.ts';
import type { DraftWorkflowRuntime } from '../runtime.ts';

export function createAggregateDraftsStep(runtime: DraftWorkflowRuntime) {
  return createStep({
    id: 'aggregate-drafts',
    inputSchema: z.array(questionResultSchema),
    outputSchema: draftOutputSchema,
    execute: async ({ inputData, getInitData }) => {
      const workflowInput = getInitData<z.infer<typeof draftInputSchema>>();
      if (!runtime.stores.has(workflowInput.runId)) await rehydrateDraftRun(runtime, workflowInput.runId);
      const store = runtime.stores.get(workflowInput.runId);
      if (!store) throw new ProcessingFailure('STORAGE_FAILURE');

      const environment = runtime.sessions.get(workflowInput.runId)?.environment;
      const comparedResults = environment ? await flagInconsistentAnswers(inputData, environment) : inputData;
      const orderedResults = comparedResults.sort((left, right) => left.order - right.order);
      for (const result of orderedResults) await store.persistResult(workflowInput.runId, result);

      try {
        store.assertAdmission();
      } catch {
        await store.stop(workflowInput.runId, 'STORAGE_FAILURE');
      }
      await store.finish(workflowInput.runId);
      const status = await store.status(workflowInput.runId);
      if (!status || status.run.state === 'processing') throw new ProcessingFailure('STORAGE_FAILURE');

      return { runId: workflowInput.runId, state: status.run.state, results: status.results };
    },
  });
}
