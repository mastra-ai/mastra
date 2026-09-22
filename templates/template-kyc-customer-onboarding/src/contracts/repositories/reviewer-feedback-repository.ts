import { z } from 'zod';

import { caseIdSchema, idempotencyKeySchema, tenantIdSchema } from '../../domain/identifiers.js';
import { reviewerFeedbackSchema } from '../../domain/review.js';

export const putReviewerFeedbackInputSchema = z
  .object({ feedback: reviewerFeedbackSchema, idempotencyKey: idempotencyKeySchema })
  .strict();
export const listReviewerFeedbackInputSchema = z.object({ tenantId: tenantIdSchema, caseId: caseIdSchema }).strict();

export interface ReviewerFeedbackRepository {
  put(input: z.infer<typeof putReviewerFeedbackInputSchema>): Promise<z.infer<typeof reviewerFeedbackSchema>>;
  list(input: z.infer<typeof listReviewerFeedbackInputSchema>): Promise<z.infer<typeof reviewerFeedbackSchema>[]>;
}
