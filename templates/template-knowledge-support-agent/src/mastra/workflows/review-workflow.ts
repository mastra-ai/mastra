import { recordOperation } from '../observability.ts';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { createTool, isValidationError } from '@mastra/core/tools';
import type { Profile } from '../identity.ts';
import { isRetryablePublicationError } from '../review/publication-errors.ts';
import {
  approvalDecisionSchema,
  approvalSchema,
  decisionSchema,
  proposalSchema,
  publicationRetryInputSchema,
  publicationSchema,
  reviewStartRequestSchema,
  ReviewConflict,
} from '../review/contracts.ts';
import type { ReviewService } from '../review/service.ts';

export function createReviewWorkflow(service: ReviewService) {
  const prepare = createStep({
    id: 'prepare-review',
    inputSchema: reviewStartRequestSchema,
    outputSchema: proposalSchema,
    execute: async ({ inputData, requestContext, mastra }) => {
      const started = performance.now();
      try {
        const proposal = await service.prepare(
          requestContext.get('mastra__user') as Profile | undefined,
          inputData,
          mastra,
        );
        recordOperation('review-proposal', 'success', started);
        return proposal;
      } catch (error) {
        recordOperation('review-proposal', 'error', started);
        throw error;
      }
    },
  });
  // Workflow steps persist their raw output. Validate the approval before saving that checkpoint.
  const recordApproval = createTool({
    id: 'record-approval',
    description: 'Record the validated reviewer decision',
    inputSchema: approvalDecisionSchema,
    outputSchema: approvalSchema,
    execute: async approval => ({
      ...approval,
      decidedAt: new Date().toISOString(),
    }),
  });
  const decision = createStep({
    id: 'review-decision',
    inputSchema: proposalSchema,
    outputSchema: approvalSchema,
    resumeSchema: decisionSchema,
    suspendSchema: proposalSchema,
    execute: async ({ inputData, resumeData, requestContext, suspend }) => {
      const reviewer = service.reviewer(requestContext.get('mastra__user') as Profile | undefined);
      if (
        reviewer.actorId !== inputData.reviewer.actorId ||
        reviewer.tenantId !== inputData.reviewer.tenantId ||
        reviewer.customerId !== inputData.reviewer.customerId
      )
        throw new ReviewConflict('Reviewer does not own this proposal');
      if (!resumeData) {
        recordOperation('review-decision', 'suspended');
        return suspend(inputData);
      }
      const approval = await recordApproval.execute!({
        proposal: inputData,
        decision: resumeData,
        reviewerId: reviewer.actorId,
      });
      if (isValidationError(approval)) throw new ReviewConflict(approval.message);
      recordOperation('review-decision', 'resumed');
      return approval!;
    },
  });
  const publicationAttempt = createTool({
    id: 'publication-attempt',
    description: 'Publish the recorded approval after validating the retry decision',
    inputSchema: publicationRetryInputSchema,
    outputSchema: publicationSchema,
    execute: ({ approval }, context) =>
      service.publish(approval, service.reviewer(context?.requestContext?.get('mastra__user') as Profile | undefined)),
  });
  const publish = createStep({
    id: 'publish-review',
    inputSchema: approvalSchema,
    outputSchema: publicationSchema,
    resumeSchema: decisionSchema,
    suspendSchema: approvalSchema,
    execute: async ({ inputData, resumeData, requestContext, suspend }) => {
      const reviewer = service.reviewer(requestContext.get('mastra__user') as Profile | undefined);
      if (
        reviewer.actorId !== inputData.reviewerId ||
        reviewer.tenantId !== inputData.proposal.reviewer.tenantId ||
        reviewer.customerId !== inputData.proposal.reviewer.customerId
      )
        throw new ReviewConflict('Reviewer does not own this approval');
      try {
        const started = performance.now();
        const result = await publicationAttempt.execute!(
          { approval: inputData, retryDecision: resumeData },
          { requestContext },
        );
        if (isValidationError(result)) throw new ReviewConflict(result.message);
        recordOperation('review-publication', result!.status, started);
        return result!;
      } catch (error) {
        recordOperation('review-publication', 'error');
        if (!isRetryablePublicationError(error)) throw error;
        // The previous successful step is the durable decision checkpoint. A retry never recomputes intent.
        recordOperation('review-publication', 'suspended');
        return suspend(inputData);
      }
    },
  });
  return createWorkflow({
    id: 'review',
    inputSchema: reviewStartRequestSchema,
    outputSchema: publicationSchema,
    // Recovery is explicit through the owner-authorized restart route. Boot-time replay has no reviewer grant.
    options: { autoRestartActiveRuns: false, shouldPersistSnapshot: () => true },
  })
    .then(prepare)
    .then(decision)
    .then(publish)
    .commit();
}
export type ReviewWorkflow = ReturnType<typeof createReviewWorkflow>;
