import { z } from 'zod';

import { documentContentReferenceSchema, documentTypeSchema, extractedIdentitySchema } from '../../domain/documents.js';
import type { providerIdSchema } from '../../domain/identifiers.js';
import { caseIdSchema, documentIdSchema } from '../../domain/identifiers.js';
import type { ProviderExecutionContext } from '../shared/execution-context.js';
import type { providerCapabilitiesSchema } from '../shared/provider.js';
import { providerExecutionMetadataSchema } from '../shared/provider.js';

export const documentExtractionInputSchema = z
  .object({
    caseId: caseIdSchema,
    documentId: documentIdSchema,
    documentTypeHint: documentTypeSchema.optional(),
    document: documentContentReferenceSchema,
    jurisdiction: z.string().length(2),
    schemaVersion: z.string().min(1).max(64),
  })
  .strict();

export const documentExtractionResultSchema = z
  .object({
    provider: providerExecutionMetadataSchema,
    documentType: documentTypeSchema,
    issuingCountry: z.string().length(2).nullable(),
    fields: extractedIdentitySchema,
    quality: z.enum(['READABLE', 'LOW_QUALITY', 'UNREADABLE']),
    missingFields: z.array(z.string().min(1).max(100)),
    warnings: z.array(z.string().min(1).max(200)),
    usage: z
      .object({
        inputUnits: z.number().int().nonnegative(),
        outputUnits: z.number().int().nonnegative(),
        estimatedCostUsd: z.number().nonnegative(),
        priceVersion: z.string().min(1).max(100),
      })
      .strict()
      .optional(),
  })
  .strict();

export type DocumentExtractionInput = z.infer<typeof documentExtractionInputSchema>;
export type DocumentExtractionResult = z.infer<typeof documentExtractionResultSchema>;

export interface MultimodalDocumentExtractionProvider {
  readonly id: z.infer<typeof providerIdSchema>;
  readonly capabilities: z.infer<typeof providerCapabilitiesSchema>;
  extract(input: DocumentExtractionInput, context: ProviderExecutionContext): Promise<DocumentExtractionResult>;
}
