import { z } from 'zod';

import { caseIdSchema, notificationIdSchema, tenantIdSchema, timestampSchema } from './identifiers.js';

export const notificationTypeSchema = z.enum(['INFORMATION_REQUIRED', 'REVIEW_REQUIRED', 'CASE_STATUS_CHANGED']);

export const notificationSchema = z
  .object({
    id: notificationIdSchema,
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    type: notificationTypeSchema,
    safeMessage: z.string().min(1).max(500),
    actionPath: z.string().min(1).max(500),
    createdAt: timestampSchema,
  })
  .strict();

export type Notification = z.infer<typeof notificationSchema>;
