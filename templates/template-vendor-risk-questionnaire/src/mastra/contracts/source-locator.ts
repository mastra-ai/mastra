import { z } from 'zod';
import { coordinate, sourceBinding } from './primitives.ts';

export const sourceLocatorSchema = z.discriminatedUnion('kind', [
  z
    .object({ ...sourceBinding, kind: z.literal('xlsx.cell'), sheet: z.string().min(1).max(128), cell: coordinate })
    .strict(),
  z
    .object({
      ...sourceBinding,
      kind: z.literal('xlsx.range'),
      sheet: z.string().min(1).max(128),
      start: coordinate,
      end: coordinate,
    })
    .strict(),
  z
    .object({
      ...sourceBinding,
      kind: z.literal('docx.table_cell'),
      part: z.string().max(160),
      table: z.int().nonnegative(),
      row: z.int().nonnegative(),
      cell: z.int().nonnegative(),
    })
    .strict(),
  z
    .object({
      ...sourceBinding,
      kind: z.literal('docx.paragraph'),
      part: z.string().max(160),
      paragraph: z.int().nonnegative(),
    })
    .strict(),
]);
export type SourceLocator = z.infer<typeof sourceLocatorSchema>;
