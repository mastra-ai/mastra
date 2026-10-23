import { z } from 'zod';

import { caseIdSchema, checksumSchema, documentIdSchema, tenantIdSchema, timestampSchema } from './identifiers.js';

export const documentTypeSchema = z.enum(['PASSPORT', 'DRIVERS_LICENSE', 'STATE_ID', 'PROOF_OF_ADDRESS', 'UNKNOWN']);

export const documentSideSchema = z.enum(['FRONT', 'BACK', 'SINGLE']);

export const documentContentReferenceSchema = z
  .object({
    storageKey: z
      .string()
      .min(1)
      .max(512)
      .refine(value => {
        try {
          return !value
            .replaceAll('\\', '/')
            .split('/')
            .map(segment => decodeURIComponent(segment))
            .some(segment => segment === '.' || segment === '..');
        } catch {
          return false;
        }
      }, 'storage key must not contain traversal segments'),
    digest: checksumSchema,
    mimeType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
    sizeBytes: z.number().int().positive(),
  })
  .strict();

export const identityDocumentSchema = z
  .object({
    id: documentIdSchema,
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    type: documentTypeSchema,
    side: documentSideSchema,
    content: documentContentReferenceSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    version: z.number().int().positive(),
  })
  .strict();

export const extractedFieldSchema = z
  .object({
    originalValue: z.string().max(500).nullable(),
    normalizedValue: z.string().max(500).nullable(),
    confidence: z.number().min(0).max(1).nullable(),
    page: z.number().int().positive().nullable(),
    evidenceText: z.string().max(250).nullable(),
  })
  .strict();

export const extractedIdentitySchema = z
  .object({
    fullName: extractedFieldSchema,
    dateOfBirth: extractedFieldSchema,
    documentNumber: extractedFieldSchema,
    expirationDate: extractedFieldSchema,
    nationality: extractedFieldSchema,
    residentialAddress: extractedFieldSchema,
  })
  .strict();

export type DocumentType = z.infer<typeof documentTypeSchema>;
export type DocumentContentReference = z.infer<typeof documentContentReferenceSchema>;
export type IdentityDocument = z.infer<typeof identityDocumentSchema>;
export type ExtractedIdentity = z.infer<typeof extractedIdentitySchema>;
