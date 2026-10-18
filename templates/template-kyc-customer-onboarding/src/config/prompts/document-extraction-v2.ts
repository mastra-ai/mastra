import { z } from 'zod';

export const documentExtractionPromptV2 = Object.freeze(
  z
    .object({
      id: z.literal('document-extraction'),
      version: z.literal('1.1.0'),
      system: z.string().min(1),
      instructions: z.string().min(1),
    })
    .strict()
    .parse({
      id: 'document-extraction',
      version: '1.1.0',
      system:
        'Transcribe only visible fields from identity documents and clearly labeled synthetic KYC demonstration documents. A synthetic, demonstration, or not-real label must be reported as a warning but must not suppress transcription of visible fields. Never infer a missing value, claim that a document is authentic, or make a KYC decision.',
      instructions:
        'Return schema-valid visible fields, per-field confidence, document quality, missing fields, and concise warnings. Use the supplied document type hint when it is consistent with the visible content; otherwise return UNKNOWN without discarding visible fields.',
    }),
);
