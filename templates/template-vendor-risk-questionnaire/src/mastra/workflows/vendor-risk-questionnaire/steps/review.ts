import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { draftOutputSchema } from '../../vendor-risk-drafts/contracts.ts';
import { reviewStateSchema, scopedRunId } from '../../../contracts/review.ts';
import { hash, id } from '../../../contracts/primitives.ts';
import { openReviewStore } from '../../../persistence/review.ts';
import { openProcessingStore } from '../../../persistence/processing.ts';
import { canonicalJson, sha256 } from '../../../intake/source.ts';
import { databaseUrl } from '../../../persistence/database.ts';
import type { DraftWorkflowOptions } from '../../vendor-risk-drafts/runtime.ts';

export const approvalReferenceSchema = z
  .object({ approvalId: id, revision: z.int().nonnegative(), digest: hash })
  .strict();
export const approvalOutputSchema = z
  .object({ runId: scopedRunId, revision: z.int().nonnegative(), approvalId: id })
  .strict();
export function createReviewStep(options: DraftWorkflowOptions) {
  return createStep({
    id: 'review-answer-set',
    inputSchema: draftOutputSchema,
    outputSchema: approvalOutputSchema,
    suspendSchema: reviewStateSchema,
    resumeSchema: approvalReferenceSchema,
    execute: async ({ inputData, runId: workflowRunId, resumeData, suspend }) => {
      const url = options.databaseUrl ?? databaseUrl;
      const store = await openProcessingStore(url),
        review = await openReviewStore(url);
      try {
        const status = await store.status(inputData.runId),
          intake = await store.readIntake(inputData.runId);
        if (!status || !intake || status.run.state === 'processing') throw new Error('MISSING_DRAFTS');
        let state = await review.read(inputData.runId);
        if (!state)
          state = await review.initialize({
            runId: inputData.runId,
            workflowRunId,
            organizationId: intake.input.organizationId,
            revision: 0,
            intakeDigest: status.run.intakeDigest,
            questions: intake.input.questions,
            results: status.results,
            digest: sha256(canonicalJson(status.results)),
            evidenceDigest: status.run.evidenceDigest,
            policyDigest: status.run.policyDigest,
            state: 'awaiting_review',
            projection: null,
            manifest: null,
            stagedManifest: null,
            claimToken: null,
            claimAt: null,
          });
        if (state.workflowRunId !== workflowRunId) throw new Error('FOREIGN_WORKFLOW');
        if (!resumeData) return suspend(state);
        if (
          !['approved', 'exporting', 'exported'].includes(state.state) ||
          state.claimToken ||
          state.revision !== resumeData.revision ||
          state.digest !== resumeData.digest ||
          state.projection?.approvalId !== resumeData.approvalId
        )
          return suspend(state);
        return { runId: state.runId, revision: state.revision, approvalId: state.projection.approvalId };
      } finally {
        store.close();
        review.close();
      }
    },
  });
}
