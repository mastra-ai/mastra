import { z } from 'zod';

import { documentContentReferenceSchema } from '../../domain/documents.js';
import { caseIdSchema, documentIdSchema, idempotencyKeySchema, tenantIdSchema } from '../../domain/identifiers.js';

export const storeDocumentInputSchema = z
  .object({
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    documentId: documentIdSchema,
    mimeType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
    bytes: z.instanceof(Uint8Array),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const openDocumentInputSchema = z
  .object({ tenantId: tenantIdSchema, reference: documentContentReferenceSchema })
  .strict();
export const removeDocumentInputSchema = openDocumentInputSchema
  .extend({ idempotencyKey: idempotencyKeySchema })
  .strict();
export const openDocumentResultSchema = z.object({ bytes: z.instanceof(Uint8Array) }).strict();

export type StoreDocumentInput = z.infer<typeof storeDocumentInputSchema>;
export type OpenDocumentInput = z.infer<typeof openDocumentInputSchema>;
export type RemoveDocumentInput = z.infer<typeof removeDocumentInputSchema>;

export interface DocumentStorage {
  store(input: StoreDocumentInput): Promise<z.infer<typeof documentContentReferenceSchema>>;
  open(input: OpenDocumentInput): Promise<z.infer<typeof openDocumentResultSchema>>;
  remove(input: RemoveDocumentInput): Promise<void>;
}
