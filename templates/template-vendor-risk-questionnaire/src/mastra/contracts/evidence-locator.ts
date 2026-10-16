import { z } from 'zod';
import { sourceBinding } from './primitives.ts';
import { sourceLocatorSchema } from './source-locator.ts';

export const evidenceLocatorSchema = z.union([
  sourceLocatorSchema.options[0],
  sourceLocatorSchema.options[1],
  z
    .object({
      ...sourceBinding,
      kind: z.literal('pdf.block'),
      page: z.int().positive().max(100),
      block: z.int().nonnegative(),
    })
    .strict(),
  z
    .object({ ...sourceBinding, kind: z.literal('csv.cell'), row: z.int().positive(), column: z.int().positive() })
    .strict(),
  z
    .object({
      ...sourceBinding,
      kind: z.literal('json.pointer'),
      pointer: z
        .string()
        .max(4000)
        .regex(/^(?:\/.*)?$/),
    })
    .strict(),
  z
    .object({
      ...sourceBinding,
      kind: z.literal('markdown.lines'),
      heading: z.string().max(4000),
      startLine: z.int().positive(),
      endLine: z.int().positive(),
    })
    .strict()
    .refine(v => v.endLine >= v.startLine),
]);
export type EvidenceLocator = z.infer<typeof evidenceLocatorSchema>;
