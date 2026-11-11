import { createTool } from '@mastra/core/tools';
import { decisionInputSchema, decisionSchema } from '../review/contracts';
import type { ReviewService } from '../review/service';

export const reviewLead = (reviewService: ReviewService) =>
  createTool({
    id: 'review-lead',
    description:
      'Record a local operator decision for a published current review packet. Identity is the authenticated local operator; uncertain approvals need a reasoned override.',
    inputSchema: decisionInputSchema,
    outputSchema: decisionSchema,
    execute: input => reviewService.decide(input),
  });
