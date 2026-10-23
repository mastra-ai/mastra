import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { InputLimits } from '../../../config/limits.js';
import { IntakeError } from './errors.js';

export const roleSchema = z.enum([
  'proposal',
  'contract',
  'issued_policy',
  'binder',
  'amendment',
  'reference',
  'unknown',
]);
export const contextSchema = z
  .object({ threadId: z.string().min(1).max(200), operatorId: z.string().min(1).max(200) })
  .strict();
export type OperationContext = z.infer<typeof contextSchema>;
const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(z.string(), jsonValue),
  ]),
);
const pageSchema = z
  .object({ physicalPage: z.number().int().positive(), text: z.string(), limitation: z.string().min(1).optional() })
  .strict();
const provenanceSchema = z
  .object({
    providerId: z.string().min(1),
    capturedAt: z.iso.datetime(),
    origin: z.string().min(1),
    sourceVersion: z.string().min(1),
  })
  .strict();
const common = {
  sourceId: z.uuid(),
  version: z.string().min(1),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  role: roleSchema,
  displayName: z.string().min(1).max(255),
  provenance: provenanceSchema,
  limitations: z.array(z.string().min(1)),
};
export const sourceSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...common,
      kind: z.literal('pdf'),
      bytes: z.instanceof(Uint8Array).refine(bytes => bytes.length > 0),
      pages: z.array(pageSchema).min(1),
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('records'),
      records: z.record(z.string().min(1), z.record(z.string().min(1), jsonValue)),
      evidence: z
        .array(z.object({ recordId: z.string().min(1), field: z.string().min(1), value: jsonValue }).strict())
        .min(1),
    })
    .strict(),
]);
export const sourceBundleSchema = z
  .object({ sources: z.array(sourceSchema).min(1) })
  .strict()
  .superRefine((bundle, context) => {
    if (new Set(bundle.sources.map(source => source.sourceId)).size !== bundle.sources.length)
      context.addIssue({ code: 'custom', message: 'Source IDs must be unique.' });
    const roles = new Map<string, string>();
    for (const source of bundle.sources) {
      const previous = roles.get(source.hash);
      if (previous && previous !== 'unknown' && source.role !== 'unknown' && previous !== source.role)
        context.addIssue({
          code: 'custom',
          message: 'Identical sources have conflicting roles.',
          params: { inputConflict: 'roles' },
        });
      if (source.role !== 'unknown') roles.set(source.hash, source.role);
      if (source.kind === 'pdf' && source.pages.some((page, index) => page.physicalPage !== index + 1))
        context.addIssue({ code: 'custom', message: 'Physical pages must be contiguous and start at one.' });
    }
  });
export type CapturedSource = z.infer<typeof sourceSchema>;
export type SourceBundle = z.infer<typeof sourceBundleSchema>;
export const hashBytes = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export function validateBundle(input: unknown, limits: InputLimits, providerId: string): SourceBundle {
  const bundle = sourceBundleSchema.parse(input);
  if (bundle.sources.length > limits.maxDocumentsPerCase)
    throw new IntakeError(
      'DOCUMENT_LIMIT',
      `At most ${limits.maxDocumentsPerCase} documents are allowed per case.`,
      'Remove excess documents or change config/limits.ts and restart.',
    );
  let pages = 0;
  for (const source of bundle.sources) {
    if (source.provenance.providerId !== providerId)
      throw new IntakeError(
        'INVALID_PROVENANCE',
        'The provider returned inconsistent capture provenance.',
        'Correct the input provider registration and captured source records.',
      );
    if (source.kind === 'pdf') {
      if (source.bytes.length > limits.pdf.maxBytesPerFile)
        throw new IntakeError(
          'BYTE_LIMIT',
          `Each PDF must be at most ${limits.pdf.maxBytesPerFile} bytes.`,
          'Upload a smaller textual PDF.',
        );
      if (source.pages.length > limits.pdf.maxPagesPerFile)
        throw new IntakeError(
          'PAGE_LIMIT',
          `Each PDF must have at most ${limits.pdf.maxPagesPerFile} physical pages.`,
          'Upload a shorter PDF or change the configured capacity.',
        );
      if (hashBytes(source.bytes) !== source.hash)
        throw new IntakeError('INVALID_EVIDENCE', 'The captured PDF hash is invalid.', 'Correct the input provider.');
      pages += source.pages.length;
    } else {
      if (hashBytes(canonicalJson(source.records)) !== source.hash)
        throw new IntakeError(
          'INVALID_EVIDENCE',
          'The captured record hash does not match its immutable content.',
          'Correct the input provider.',
        );
      for (const item of source.evidence) {
        const record = source.records[item.recordId];
        if (
          !record ||
          !Object.hasOwn(record, item.field) ||
          canonicalJson(record[item.field]) !== canonicalJson(item.value)
        )
          throw new IntakeError(
            'INVALID_EVIDENCE',
            'A record/field evidence locator or value is absent from the captured source.',
            'Supply verifiable record and field locators.',
          );
      }
    }
  }
  if (pages > limits.pdf.maxPagesPerCase)
    throw new IntakeError(
      'CASE_PAGE_LIMIT',
      `A case may contain at most ${limits.pdf.maxPagesPerCase} physical PDF pages.`,
      'Remove excess pages or change config/limits.ts and restart.',
    );
  return bundle;
}
export interface InputProvider {
  id: string;
  category: 'input';
  capabilities: readonly string[];
  requestSchema: z.ZodType;
  capture(request: unknown, context: OperationContext, limits: InputLimits): Promise<SourceBundle>;
}
export const outputRequestSchema = z
  .object({
    operationId: z.uuid(),
    snapshotId: z.uuid(),
    snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
    snapshot: z.record(z.string(), jsonValue),
    approval: z
      .object({ id: z.uuid(), snapshotHash: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict()
      .optional(),
  })
  .strict();
export const outputArtifactSchema = z
  .object({
    providerId: z.string().min(1),
    stage: z.enum(['draftOutput', 'reportOutput', 'correctionOutput']),
    displayName: z.string().min(1),
    mediaType: z.string().min(1),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    snapshotId: z.uuid(),
    approvalId: z.uuid().optional(),
    retrievalReference: z.string().min(1),
  })
  .strict();
export interface OutputProvider<C extends 'draftOutput' | 'reportOutput' | 'correctionOutput'> {
  id: string;
  category: C;
  capabilities: readonly string[];
  materialize(
    request: z.infer<typeof outputRequestSchema>,
    context: OperationContext,
  ): Promise<z.infer<typeof outputArtifactSchema>>;
}
export type ProviderCategories = {
  input: InputProvider;
  draftOutput: OutputProvider<'draftOutput'>;
  reportOutput: OutputProvider<'reportOutput'>;
  correctionOutput: OutputProvider<'correctionOutput'>;
};
