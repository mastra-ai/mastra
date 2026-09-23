import { z } from 'zod';

export const documentExtractionPromptSchema = z
  .object({
    id: z.literal('document-extraction'),
    version: z.literal('1.0.0'),
    system: z.string().min(1),
    instructions: z.string().min(1),
  })
  .strict();

export const documentExtractionPromptV1 = Object.freeze(
  documentExtractionPromptSchema.parse({
    id: 'document-extraction',
    version: '1.0.0',
    system: 'Extract only visible identity-document fields. Never infer a missing value or make a KYC decision.',
    instructions:
      'Return schema-valid fields, per-field confidence, document quality, missing fields, and concise warnings.',
  }),
);
