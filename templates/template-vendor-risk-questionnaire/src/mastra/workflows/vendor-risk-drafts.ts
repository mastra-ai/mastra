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
    options,
    sessions: new Map(),
    stores: new Map(),
    workflowOwners: new Map(),
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
      onFinish: async ({ runId: workflowRunId, getInitData }) => {
        const intakeRunId = getInitData()?.runId;
        if (typeof intakeRunId !== 'string' || runtime.workflowOwners.get(intakeRunId) !== workflowRunId) return;

        const store = runtime.stores.get(intakeRunId);
        if (store) await store.stop(intakeRunId, 'STORAGE_FAILURE').catch(() => {});
        closeDraftRun(runtime, intakeRunId);
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
