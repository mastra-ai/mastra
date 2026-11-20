import { recordOperation } from '../observability.ts';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import type { Profile } from '../identity.ts';
import {
  approvalSchema,
  decisionSchema,
  proposalSchema,
  publicationRetryInputSchema,
  publicationSchema,
  reviewInputSchema,
  ReviewConflict,
} from '../review/contracts.ts';
import type { ReviewService } from '../review/service.ts';

export function createReviewWorkflow(service: ReviewService) {
  const prepare = createStep({
    id: 'prepare-review',
    inputSchema: reviewInputSchema,
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
      const approval = approvalSchema.parse({
        proposal: inputData,
        decision: resumeData,
        reviewerId: reviewer.actorId,
        decidedAt: new Date().toISOString(),
      });
      recordOperation('review-decision', 'resumed');
      return approval;
    },
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
      const { approval } = publicationRetryInputSchema.parse({ approval: inputData, retryDecision: resumeData });
      try {
        const started = performance.now();
        const result = await service.publish(approval);
        recordOperation('review-publication', result.status, started);
        return result;
      } catch (error) {
        recordOperation('review-publication', 'error');
        if (error instanceof ReviewConflict) throw error;
        // The previous successful step is the durable decision checkpoint. A retry never recomputes intent.
        recordOperation('review-publication', 'suspended');
        return suspend(inputData);
      }
    },
  });
  return createWorkflow({
    id: 'review',
    inputSchema: reviewInputSchema,
    outputSchema: publicationSchema,
    options: { autoRestartActiveRuns: false, shouldPersistSnapshot: () => true },
  })
    .then(prepare)
    .then(decision)
    .then(publish)
    .commit();
}
export type ReviewWorkflow = ReturnType<typeof createReviewWorkflow>;
