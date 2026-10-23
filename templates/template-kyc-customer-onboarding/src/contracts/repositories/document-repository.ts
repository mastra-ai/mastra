import { z } from 'zod';

import { identityDocumentSchema } from '../../domain/documents.js';
import { caseIdSchema, documentIdSchema, idempotencyKeySchema, tenantIdSchema } from '../../domain/identifiers.js';

export const putDocumentInputSchema = z
  .object({
    document: identityDocumentSchema,
    idempotencyKey: idempotencyKeySchema,
    requestFingerprint: z.string().min(1).max(128),
  })
  .strict();
export const getDocumentInputSchema = z.object({ tenantId: tenantIdSchema, documentId: documentIdSchema }).strict();
export const listDocumentsInputSchema = z.object({ tenantId: tenantIdSchema, caseId: caseIdSchema }).strict();

export interface DocumentRepository {
  put(input: z.infer<typeof putDocumentInputSchema>): Promise<z.infer<typeof identityDocumentSchema>>;
  get(input: z.infer<typeof getDocumentInputSchema>): Promise<z.infer<typeof identityDocumentSchema>>;
  list(input: z.infer<typeof listDocumentsInputSchema>): Promise<z.infer<typeof identityDocumentSchema>[]>;
}
