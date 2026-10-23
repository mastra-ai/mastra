import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { InputLimits } from '../config/limits.js';
import { IntakeError } from './errors.js';

export const portSchema = z.coerce.number().int().min(1024).max(65535);
export const operatorIdSchema = z.string().min(1).max(200);
export const applicationConfigurationSchema = z
  .object({
    port: portSchema.default(4111),
    operatorId: operatorIdSchema.default('local-broker'),
    dataDirectory: z.string().min(1).default('.runtime'),
  })
  .strict();

export const roleSchema = z.enum([
  'proposal',
  'contract',
  'issued_policy',
  'binder',
  'amendment',
  'reference',
  'unknown',
]);
export const identitySchema = z
  .object({
    policyNumber: z.string().min(1).max(200).nullable(),
    insuredName: z.string().min(1).max(200).nullable(),
    insuranceProduct: z.string().min(1).max(200).nullable(),
  })
  .strict();
export const clarifySchema = z
  .object({
    caseId: z.uuid(),
    expectedRevision: z.number().int().positive(),
    identity: identitySchema,
    intent: z.enum(['document_comparison', 'agreed_terms_checking']),
    referenceId: z.uuid(),
    targetId: z.uuid(),
    roles: z.array(z.object({ sourceId: z.uuid(), role: roleSchema.exclude(['unknown']) }).strict()).min(2),
    acceptedBaseline: z
      .object({ statement: z.string().min(1).max(2000), sourceId: z.uuid() })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.referenceId === value.targetId)
      context.addIssue({ code: 'custom', message: 'Reference and target must be distinct.' });
    if (new Set(value.roles.map(role => role.sourceId)).size !== value.roles.length)
      context.addIssue({ code: 'custom', message: 'A source may have only one declared role.' });
    if (
      value.intent === 'agreed_terms_checking' &&
      (!value.acceptedBaseline ||
        value.acceptedBaseline.sourceId !== value.referenceId ||
        value.roles.find(role => role.sourceId === value.targetId)?.role !== 'issued_policy' ||
        !['proposal', 'contract'].includes(value.roles.find(role => role.sourceId === value.referenceId)?.role ?? ''))
    )
      context.addIssue({
        code: 'custom',
        message: 'Agreed-term checking needs an explicitly accepted proposal or contract and an issued target policy.',
      });
    if (value.intent === 'document_comparison' && value.acceptedBaseline)
      context.addIssue({ code: 'custom', message: 'Use agreed-term checking when declaring contractual acceptance.' });
  });
export type Clarification = z.infer<typeof clarifySchema>;
export type CaseRecord = {
  id: string;
  revision: number;
  state: 'CREATED' | 'PROCESSING' | 'FAILED' | 'AWAITING_REVIEW';
  latestReportId?: string;
  latestAnalysisId?: string;
  createdAt: string;
  identity: z.infer<typeof identitySchema>;
  clarification: Clarification | null;
  sourceIds: string[];
  limits: InputLimits;
  providerId: string;
};

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
      'Remove excess documents or change src/mastra/config/limits.ts and restart.',
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
      'Remove excess pages or change src/mastra/config/limits.ts and restart.',
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
export const outputArtifactSchema = z
  .object({
    providerId: z.string().min(1),
    stage: z.enum(['draftOutput', 'reportOutput', 'correctionOutput']),
    displayName: z
      .string()
      .min(1)
      .max(180)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
    mediaType: z.enum(['application/pdf', 'application/json', 'text/markdown']),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    snapshotId: z.uuid(),
    snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
    operationId: z.uuid(),
    approvalId: z.uuid().optional(),
    retrievalReference: z.string().min(1),
  })
  .strict()
  .refine(
    a => (a.stage === 'draftOutput' ? a.approvalId === undefined : a.approvalId !== undefined),
    'Drafts cannot carry approval; approved output requires its approval binding.',
  );
export interface OutputProvider<C extends 'draftOutput' | 'reportOutput' | 'correctionOutput'> {
  id: string;
  category: C;
  capabilities: readonly string[];
  materialize(
    request: import('./output-contracts.js').OutputRequest<C>,
    context: OperationContext & { outputDirectory: string },
  ): Promise<z.infer<typeof outputArtifactSchema>>;
  retrieve(
    artifact: z.infer<typeof outputArtifactSchema>,
    context: OperationContext & { outputDirectory: string },
  ): Promise<Uint8Array>;
}
export type ProviderCategories = {
  input: InputProvider;
  draftOutput: OutputProvider<'draftOutput'>;
  reportOutput: OutputProvider<'reportOutput'>;
  correctionOutput: OutputProvider<'correctionOutput'>;
};
