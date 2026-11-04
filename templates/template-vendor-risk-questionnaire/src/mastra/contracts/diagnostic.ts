import { z } from 'zod';
import { id } from './primitives.ts';
import { sourceLocatorSchema } from './source-locator.ts';

export const diagnosticCodes = [
  'UNSUPPORTED_FORMAT',
  'FORMAT_MISMATCH',
  'CORRUPT_FILE',
  'ENCRYPTED_FILE',
  'UNSUPPORTED_LAYOUT',
  'UNSUPPORTED_FIELD_TYPE',
  'MAPPING_REQUIRED',
  'INVALID_MAPPING',
  'SOURCE_CHANGED',
  'DUPLICATE_QUESTION_ID',
  'EMPTY_QUESTION',
  'FORMULA_NOT_ALLOWED',
  'UNACCOUNTED_CONTENT',
  'LIMIT_EXCEEDED',
  'READ_FAILED',
  'PARSER_FAILED',
  'CANCELLED',
] as const;
export const diagnosticSchema = z
  .object({
    code: z.enum(diagnosticCodes),
    severity: z.enum(['warning', 'error']),
    sourceId: id,
    location: sourceLocatorSchema.optional(),
    message: z.string().max(1000),
    action: z.string().max(1000),
  })
  .strict();
export type Diagnostic = z.infer<typeof diagnosticSchema>;
