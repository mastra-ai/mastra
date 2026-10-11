import { createWorkflow, createStep, createWorkflowStateReader } from '@mastra/core/workflows';
import { draftInputSchema } from './vendor-risk-drafts/contracts.ts';
import { createDraftWorkflow } from './vendor-risk-drafts.ts';
import type { DraftWorkflowOptions } from './vendor-risk-drafts/runtime.ts';
import { createReviewStep } from './vendor-risk-questionnaire/steps/review.ts';
import { createExportStep } from './vendor-risk-questionnaire/steps/export.ts';
import { exportManifestSchema } from '../contracts/review.ts';
import { openIntakeStore } from '../persistence/store.ts';
import { databaseUrl } from '../persistence/database.ts';

export function createQuestionnaireWorkflow(options: DraftWorkflowOptions = {}) {
  const canonical = createStep({
    id: 'canonical-intake',
    inputSchema: draftInputSchema,
    outputSchema: draftInputSchema,
    execute: async ({ inputData }) => {
      const store = await openIntakeStore(options.databaseUrl ?? databaseUrl);
      try {
        const intake = await store.readIntake(inputData.runId),
          evidence = await store.readEvidence(inputData.runId);
        if (!intake || !evidence || intake.input.organizationId !== evidence.scope.organizationId)
          throw new Error('CANONICAL_INTAKE_REQUIRED');
        return inputData;
      } finally {
        store.close();
      }
    },
  });
  return createWorkflow({
    id: 'vendor-risk-questionnaire',
    description: 'Persist drafts, suspend once for exact-set review and publish a complete approved bundle.',
    inputSchema: draftInputSchema,
    outputSchema: exportManifestSchema,
    options: { autoRestartActiveRuns: false },
  })
    .then(canonical)
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
