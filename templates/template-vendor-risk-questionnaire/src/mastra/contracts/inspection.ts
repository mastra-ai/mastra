import { z } from 'zod';
import { id, hash } from './primitives.ts';
import { sourceLocatorSchema } from './source-locator.ts';
import { diagnosticSchema } from './diagnostic.ts';
import { mappingSchema } from './mapping.ts';

export const regionSchema = z
  .object({
    id,
    location: sourceLocatorSchema,
    classification: z.enum(['questions', 'instructions', 'header', 'empty', 'unsupported']),
    candidateCount: z.int().nonnegative(),
    candidateRows: z.array(z.int().nonnegative()).max(2_000_000),
    rowCount: z.int().nonnegative(),
    columnCount: z.int().nonnegative(),
    hidden: z.boolean().optional(),
  })
  .strict()
  .refine(
    v =>
      v.candidateRows.length === v.candidateCount &&
      v.candidateCount <= v.rowCount &&
      v.candidateRows.every(
        (row, index) =>
          (index === 0 || row > v.candidateRows[index - 1]!) &&
          (v.location.kind.startsWith('xlsx.')
            ? row <= 1_048_575
            : v.location.kind === 'docx.table_cell'
              ? row < v.rowCount
              : row === 0),
      ),
  );
export type InputRegion = z.infer<typeof regionSchema>;
export const inspectionSchema = z
  .object({
    contractVersion: z.literal(1),
    status: z.enum(['ready', 'needs_mapping', 'rejected']),
    sourceSha256: hash,
    adapterKey: id,
    adapterVersion: z.string().max(40),
    regions: z.array(regionSchema).max(4000),
    mappingCandidates: z.array(mappingSchema).max(100),
    diagnostics: z.array(diagnosticSchema).max(4000),
  })
  .strict()
  .refine(
    v => v.status !== 'ready' || (!v.diagnostics.some(d => d.severity === 'error') && v.mappingCandidates.length === 1),
  );
export type InputInspection = z.infer<typeof inspectionSchema>;
