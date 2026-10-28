import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { reviewDecisionIdSchema, reviewIdSchema } from '../../../../domain/identifiers.js';
import { riskProgressSchema } from './assess-risk.js';

export const reviewProgressSchema = riskProgressSchema
  .extend({
    reviewLevel: z.enum(['INITIAL', 'SENIOR']),
    reviewId: reviewIdSchema.nullable(),
    priorReviewId: reviewIdSchema.nullable(),
    decisionId: reviewDecisionIdSchema.nullable(),
    decision: z.enum(['APPROVE', 'REJECT', 'ESCALATE']).nullable(),
    needsSeniorReview: z.boolean(),
  })
  .strict();

export const createPrepareReviewStep = () =>
  createStep({
    id: 'prepare-compliance-review-v1',
    inputSchema: riskProgressSchema,
    outputSchema: reviewProgressSchema,
    execute: ({ inputData }) =>
      Promise.resolve(
        reviewProgressSchema.parse({
          ...inputData,
          reviewLevel: 'INITIAL',
          reviewId: null,
          priorReviewId: null,
          decisionId: null,
          decision: null,
          needsSeniorReview: false,
        }),
      ),
  });
