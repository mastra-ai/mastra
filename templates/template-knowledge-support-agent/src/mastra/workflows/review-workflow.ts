import { createStep, createWorkflow } from '@mastra/core/workflows';
import type { Profile } from '../identity.ts';
import {
  approvalSchema,
  decisionSchema,
  proposalSchema,
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
    execute: async ({ inputData, requestContext }) =>
      service.prepare(requestContext.get('mastra__user') as Profile | undefined, inputData),
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
      if (!resumeData) return suspend(inputData);
      if (resumeData.revision !== inputData.revision) throw new ReviewConflict('Decision revision mismatch');
      return {
        proposal: inputData,
        decision: resumeData,
        reviewerId: reviewer.actorId,
        decidedAt: new Date().toISOString(),
      };
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
      if (resumeData && JSON.stringify(resumeData) !== JSON.stringify(inputData.decision))
        throw new ReviewConflict('Retry must replay the exact recorded decision');
      try {
        return await service.publish(inputData);
      } catch (error) {
        if (error instanceof ReviewConflict) throw error;
        // The previous successful step is the durable decision checkpoint. A retry never recomputes intent.
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
