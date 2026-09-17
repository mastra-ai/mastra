import {
  feedbackRecordSchema,
  listFeedbackResponseSchema as storageListFeedbackResponseSchema,
} from '@internal/core/storage';
import { z } from 'zod/v4';

export const listFeedbackResponseSchema = storageListFeedbackResponseSchema.extend({
  feedback: z.array(
    feedbackRecordSchema.extend({
      author: z
        .object({
          id: z.string(),
          name: z.string().optional(),
          email: z.string().optional(),
          avatarUrl: z.string().optional(),
        })
        .optional(),
    }),
  ),
});
