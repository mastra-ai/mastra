import { createWorkflow, createWorkflowStateReader } from '@mastra/core/workflows';
import { draftInputSchema } from './vendor-risk-drafts/contracts.ts';
import { createDraftWorkflow } from './vendor-risk-drafts.ts';
import type { DraftWorkflowOptions } from './vendor-risk-drafts/runtime.ts';
import { createReviewStep } from './vendor-risk-questionnaire/steps/review.ts';
import { createExportStep } from './vendor-risk-questionnaire/steps/export.ts';
import { documentResultSchema } from '../contracts/completion.ts';
import { createCanonicalIntakeStep } from './vendor-risk-questionnaire/steps/canonical-intake.ts';

export function createQuestionnaireWorkflow(options: DraftWorkflowOptions = {}) {
  return createWorkflow({
    id: 'vendor-risk-questionnaire',
    description:
      'Persist drafts, suspend once for exact-set review and publish one source-preserving answered document.',
    inputSchema: draftInputSchema,
    outputSchema: documentResultSchema,
    options: { autoRestartActiveRuns: false },
  })
    .then(createCanonicalIntakeStep(options))
    .then(createDraftWorkflow(options))
    .then(createReviewStep(options))
    .then(createExportStep(options))
    .commit();
}
export const vendorRiskQuestionnaire = createQuestionnaireWorkflow();
export async function recoverQuestionnaire(
  workflow: ReturnType<typeof createQuestionnaireWorkflow>,
  workflowRunId: string,
) {
  const snapshot = await workflow.getWorkflowRunById(workflowRunId);
  if (!snapshot) throw new Error('WORKFLOW_NOT_FOUND');
  const reader = createWorkflowStateReader(snapshot);
  return { reader, run: await workflow.createRun({ runId: workflowRunId }) };
}
