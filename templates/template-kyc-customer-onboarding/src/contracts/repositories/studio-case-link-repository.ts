import { z } from 'zod';

import {
  caseIdSchema,
  idempotencyKeySchema,
  tenantIdSchema,
  threadIdSchema,
  timestampSchema,
  workflowRunIdSchema,
} from '../../domain/identifiers.js';

export const studioCaseLinkSchema = z
  .object({
    tenantId: tenantIdSchema,
    threadId: threadIdSchema,
    caseId: caseIdSchema,
    workflowRunId: workflowRunIdSchema,
    status: z.enum(['ACTIVE', 'COMPLETED']),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const putStudioCaseLinkInputSchema = z
  .object({
    link: studioCaseLinkSchema,
    idempotencyKey: idempotencyKeySchema,
    requestFingerprint: z.string().min(1).max(128),
  })
  .strict();

export const getActiveStudioCaseLinkInputSchema = z
  .object({ tenantId: tenantIdSchema, threadId: threadIdSchema })
  .strict();

export const getStudioCaseLinkByRunInputSchema = z
  .object({ tenantId: tenantIdSchema, workflowRunId: workflowRunIdSchema })
  .strict();

export const listActiveStudioCaseLinksInputSchema = getActiveStudioCaseLinkInputSchema;

export const completeStudioCaseLinkInputSchema = getStudioCaseLinkByRunInputSchema
  .extend({ completedAt: timestampSchema })
  .strict();

export interface StudioCaseLinkRepository {
  put(input: z.infer<typeof putStudioCaseLinkInputSchema>): Promise<z.infer<typeof studioCaseLinkSchema>>;
  getActive(
    input: z.infer<typeof getActiveStudioCaseLinkInputSchema>,
  ): Promise<z.infer<typeof studioCaseLinkSchema> | undefined>;
  getByRun(
    input: z.infer<typeof getStudioCaseLinkByRunInputSchema>,
  ): Promise<z.infer<typeof studioCaseLinkSchema> | undefined>;
  listActive(
    input: z.infer<typeof listActiveStudioCaseLinksInputSchema>,
  ): Promise<z.infer<typeof studioCaseLinkSchema>[]>;
  complete(input: z.infer<typeof completeStudioCaseLinkInputSchema>): Promise<z.infer<typeof studioCaseLinkSchema>>;
}
