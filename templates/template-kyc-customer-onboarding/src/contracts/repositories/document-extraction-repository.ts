import { z } from 'zod';

import { documentExtractionResultSchema } from '../providers/document-extraction.js';
import {
  caseIdSchema,
  documentIdSchema,
  idempotencyKeySchema,
  modelIdSchema,
  tenantIdSchema,
  timestampSchema,
} from '../../domain/identifiers.js';

export const persistedDocumentExtractionSchema = z
  .object({
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    documentId: documentIdSchema,
    schemaVersion: z.string().min(1).max(64),
    promptVersion: z.string().min(1).max(64),
    modelId: modelIdSchema,
    result: documentExtractionResultSchema,
    createdAt: timestampSchema,
  })
  .strict();

export const putDocumentExtractionInputSchema = z
  .object({
    extraction: persistedDocumentExtractionSchema,
    idempotencyKey: idempotencyKeySchema,
    requestFingerprint: z.string().min(1).max(128),
  })
  .strict();

export const getDocumentExtractionInputSchema = z
  .object({ tenantId: tenantIdSchema, documentId: documentIdSchema })
  .strict();

export interface DocumentExtractionRepository {
  put(
    input: z.infer<typeof putDocumentExtractionInputSchema>,
  ): Promise<z.infer<typeof persistedDocumentExtractionSchema>>;
  get(
    input: z.infer<typeof getDocumentExtractionInputSchema>,
  ): Promise<z.infer<typeof persistedDocumentExtractionSchema>>;
}
