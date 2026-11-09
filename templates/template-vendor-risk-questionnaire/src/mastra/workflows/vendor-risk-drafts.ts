import { StorageOwner } from '../persistence/client.ts';
import { databaseUrl, storageOwner } from '../persistence/database.ts';
import { createWorkflow } from '@mastra/core/workflows';

import { questionResultSchema } from '../contracts/answer.ts';
import { draftInputSchema, draftOutputSchema, draftQuestionInputSchema } from './vendor-risk-drafts/contracts.ts';
import { closeDraftRun } from './vendor-risk-drafts/runtime.ts';
import type { DraftWorkflowOptions, DraftWorkflowRuntime } from './vendor-risk-drafts/runtime.ts';
import { createAggregateDraftsStep } from './vendor-risk-drafts/steps/aggregate.ts';
import { createDraftQuestionStep } from './vendor-risk-drafts/steps/draft-question.ts';
import { createPrepareDraftRunStep } from './vendor-risk-drafts/steps/prepare.ts';

export { draftInputSchema } from './vendor-risk-drafts/contracts.ts';

export function createDraftWorkflow(options: DraftWorkflowOptions = {}) {
  const runtime: DraftWorkflowRuntime = {
    options: {
      ...options,
      storageOwner:
        options.storageOwner ??
        (!options.databaseUrl || options.databaseUrl === databaseUrl ? storageOwner : new StorageOwner()),
    },
    sessions: new Map(),
    stores: new Map(),
    workflowOwners: new Map(),
    rehydrating: new Map(),
  };

  const prepare = createPrepareDraftRunStep(runtime);
  const draftQuestion = createDraftQuestionStep(runtime);
  const aggregate = createAggregateDraftsStep(runtime);

  const questionWorkflow = createWorkflow({
    id: 'vrq-question',
    inputSchema: draftQuestionInputSchema,
    outputSchema: questionResultSchema,
  })
    .then(draftQuestion)
    .commit();

  return createWorkflow({
    id: 'vendor-risk-drafts',
    description:
      'Draft cited vendor questionnaire answers from a persisted intake and approved evidence snapshot. Every result still requires human release.',
    inputSchema: draftInputSchema,
    outputSchema: draftOutputSchema,
    options: {
      autoRestartActiveRuns: false,
      onFinish: async ({ runId: workflowRunId, getInitData, mastra }) => {
        const intakeRunId = getInitData()?.runId;
        if (typeof intakeRunId !== 'string' || runtime.workflowOwners.get(intakeRunId) !== workflowRunId) return;

        try {
          await mastra?.observability.flush();
          const store = runtime.stores.get(intakeRunId);
          if (runtime.options.storageOwner?.stopped) await runtime.options.storageOwner.settle(intakeRunId);
          else if (store && (await store.status(intakeRunId))?.run.state === 'processing')
            await store.stop(intakeRunId, 'STORAGE_FAILURE');
        } finally {
          await closeDraftRun(runtime, intakeRunId);
        }
      },
    },
  })
    .then(prepare)
    .foreach(questionWorkflow, {
      concurrency: ({ getInitData }) => draftInputSchema.parse(getInitData()).policy.concurrency,
    })
    .then(aggregate)
    .commit();
}

export const vendorRiskDrafts = createDraftWorkflow();
