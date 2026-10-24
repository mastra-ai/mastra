import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { InputLimits } from '../config/input-limits-config.js';
import { IntakeError } from './operation-errors.js';

export const portSchema = z.coerce.number().int().min(1024).max(65535);
export const operatorIdSchema = z.string().min(1).max(200);
export const applicationConfigurationSchema = z
  .object({
    port: portSchema.default(4111).describe('Local Studio port; defaults to 4111.'),
    operatorId: operatorIdSchema
      .default('local-broker')
      .describe('Trusted local operator identifier used to scope case access.'),
    dataDirectory: z
      .string()
      .min(1)
      .default('.runtime')
      .describe('Private runtime directory, relative to the project root or absolute.'),
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
    policyNumber: z
      .string()
      .min(1)
      .max(200)
      .nullable()
      .describe('Policy identifier as documented; null when it is not established.'),
    insuredName: z
      .string()
      .min(1)
      .max(200)
      .nullable()
      .describe('Insured person or organization as documented; null when unknown.'),
    insuranceProduct: z
      .string()
      .min(1)
      .max(200)
      .nullable()
      .describe('Insurance product or line of business; null when unknown.'),
  })
  .strict();
export const clarifySchema = z
  .object({
    caseId: z.uuid().describe('Identifier of the case selected in this conversation.'),
    expectedRevision: z
      .number()
      .int()
      .positive()
      .describe('Latest case revision observed by the caller; rejects stale updates.'),
    identity: identitySchema.describe('Broker-declared policy identity, with unknown fields preserved as null.'),
    intent: z
      .enum(['document_comparison', 'agreed_terms_checking'])
      .describe('Document comparison or checking against explicitly accepted agreed terms.'),
    referenceId: z
      .uuid()
      .describe('Captured source chosen as the comparison reference; selection alone does not establish acceptance.'),
    targetId: z.uuid().describe('Distinct captured source whose terms are being checked.'),
    roles: z
      .array(
        z
          .object({
            sourceId: z.uuid().describe('Immutable captured source identifier; copy it exactly from the source.'),
            role: roleSchema
              .exclude(['unknown'])
              .describe('Declared document role; unknown until the broker identifies it.'),
          })
          .strict(),
      )
      .min(2)
      .describe('Explicit document role assigned to each identified captured source.'),
    acceptedBaseline: z
      .object({
        statement: z
          .string()
          .min(1)
          .max(2000)
          .describe('Broker statement explicitly recording acceptance of this reference.'),
        sourceId: z.uuid().describe('Immutable captured source identifier; copy it exactly from the source.'),
      })
      .strict()
      .nullable()
      .describe('Explicit broker acceptance bound to the reference source; null for ordinary document comparison.'),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.referenceId === value.targetId)
      context.addIssue({ code: 'custom', message: 'Reference and target must be distinct.' });
    if (new Set(value.roles.map(role => role.sourceId)).size !== value.roles.length)
      context.addIssue({ code: 'custom', message: 'A source may have only one declared role.' });
    const roles = new Map(value.roles.map(role => [role.sourceId, role.role]));
    if (!roles.has(value.referenceId) || !roles.has(value.targetId))
      context.addIssue({
        code: 'custom',
        path: ['roles'],
        message: 'Reference and target both need an explicit document role.',
      });
    if (
      value.intent === 'agreed_terms_checking' &&
      (!value.acceptedBaseline ||
        value.acceptedBaseline.sourceId !== value.referenceId ||
        roles.get(value.targetId) !== 'issued_policy' ||
        !['proposal', 'contract'].includes(roles.get(value.referenceId) ?? ''))
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
  /** Stable identifier of this persisted entity. */
  id: string;

  /** Monotonically increasing case revision used to reject stale updates. */
  revision: number;

  /** Persisted lifecycle state of this entity. */
  state:
    | 'CREATED'
    | 'PROCESSING'
    | 'FAILED'
    | 'AWAITING_REVIEW'
    | 'REVISION_REQUESTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'FINALIZED';

  /** Recorded broker revision request authorizing further work on an existing report. */
  revisionAuthority?: {
    /** Identifier of the exact immutable report version. */
    reportId: string;

    /** Persisted review event that authorized the revision. */
    eventId: string;

    /** Presentation-only revision or a revision requiring new evidence. */
    kind: 'presentation' | 'evidence';

    /** Broker instruction describing the requested revision. */
    note: string;

    /** Workflow or evaluation run identifier used for correlation. */
    runId?: string;
  };

  /** Identifier of the current report snapshot, when one has been created. */
  latestReportId?: string;

  /** Identifier of the current completed analysis, when available. */
  latestAnalysisId?: string;

  /** UTC timestamp when this immutable record was created. */
  createdAt: string;

  /** Broker-declared policy identity, with unknown fields preserved as null. */
  identity: z.infer<typeof identitySchema>;

  /** Explicit broker statement of identity, intent, reference, target and source roles. */
  clarification: Clarification | null;

  /** Immutable source identifiers belonging to this case. */
  sourceIds: string[];

  /** Input capacities frozen with this case capture. */
  limits: InputLimits;

  /** Stable identifier of the provider that captured or produced this item. */
  providerId: string;
};

export const contextSchema = z
  .object({
    threadId: z
      .string()
      .min(1)
      .max(200)
      .describe('Persistent conversation identifier used with the operator to scope access.'),
    operatorId: z.string().min(1).max(200).describe('Trusted local operator identifier used to scope case access.'),
  })
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
  .object({
    physicalPage: z
      .number()
      .int()
      .positive()
      .describe('One-based physical PDF page; null or absent for a record/field locator.'),
    text: z.string().describe('Searchable text captured from this physical PDF page.'),
    limitation: z.string().min(1).optional().describe('Extraction limitation affecting this page, when present.'),
  })
  .strict();
const provenanceSchema = z
  .object({
    providerId: z.string().min(1).describe('Stable identifier of the provider that captured or produced this item.'),
    capturedAt: z.iso.datetime().describe('UTC timestamp when the immutable source was captured.'),
    origin: z.string().min(1).describe('Capture origin recorded by the input provider.'),
    sourceVersion: z.string().min(1).describe('Version of the original source recorded at capture.'),
  })
  .strict();
const common = {
  sourceId: z.uuid().describe('Immutable captured source identifier; copy it exactly from the source.'),
  version: z.string().min(1).describe('Immutable version of this source or report.'),
  hash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .describe('SHA-256 checksum of the immutable content, encoded as 64 lowercase hexadecimal characters.'),
  role: roleSchema.describe('Declared document role; unknown until the broker identifies it.'),
  displayName: z.string().min(1).max(255).describe('Human-readable source or artifact filename.'),
  provenance: provenanceSchema.describe(
    'Provider, capture time, origin and original version of this immutable source.',
  ),
  limitations: z
    .array(z.string().min(1))
    .describe('Known limits on extraction, review scope or interpretation; an empty array means none recorded.'),
};
export const sourceSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...common,
      kind: z.literal('pdf').describe('Discriminator identifying PDF content or structured records.'),
      bytes: z
        .instanceof(Uint8Array)
        .refine(bytes => bytes.length > 0)
        .describe('Nonempty original PDF bytes retained for integrity verification.'),
      pages: z.array(pageSchema).min(1).describe('Captured physical PDF pages in contiguous order starting at one.'),
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('records').describe('Discriminator identifying PDF content or structured records.'),
      records: z
        .record(z.string().min(1), z.record(z.string().min(1), jsonValue))
        .describe('Immutable structured records indexed by record identifier and field name.'),
      evidence: z
        .array(
          z
            .object({
              recordId: z.string().min(1).describe('Captured record identifier; null or absent for a PDF page.'),
              field: z
                .string()
                .min(1)
                .describe('Captured field name within the identified record; null or absent for a PDF page.'),
              value: jsonValue.describe('Exact JSON value captured at the identified record and field.'),
            })
            .strict(),
        )
        .min(1)
        .describe('Verifiable source quotations and their exact immutable locators.'),
    })
    .strict(),
]);
export const sourceBundleSchema = z
  .object({ sources: z.array(sourceSchema).min(1).describe('Immutable sources captured for this case.') })
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
/** Serialize JSON with recursive UTF-16 code-unit key ordering, independent of the process locale. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
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
      'Remove excess documents or change src/mastra/config/input-limits-config.ts and restart.',
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
      'Remove excess pages or change src/mastra/config/input-limits-config.ts and restart.',
    );
  return bundle;
}
export interface InputProvider {
  /** Stable provider identifier used in registration and persisted provenance. */
  id: string;

  /** Provider category selecting its supported capture or output stage. */
  category: 'input';

  /** Supported capabilities required when resolving this provider registration. */
  capabilities: readonly string[];

  /** Schema validating provider-specific capture requests before execution. */
  requestSchema: z.ZodType;

  /** Capture immutable source content with provenance and verifiable evidence. */
  capture(request: unknown, context: OperationContext, limits: InputLimits): Promise<SourceBundle>;
}
export const outputArtifactSchema = z
  .object({
    providerId: z.string().min(1).describe('Stable identifier of the provider that captured or produced this item.'),
    stage: z
      .enum(['draftOutput', 'reportOutput', 'correctionOutput'])
      .describe('Provider output stage: draft, approved report or proposed correction.'),
    displayName: z
      .string()
      .min(1)
      .max(180)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
      .describe('Human-readable source or artifact filename.'),
    mediaType: z
      .enum(['application/pdf', 'application/json', 'text/markdown'])
      .describe('Supported MIME type of the produced artifact.'),
    hash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .describe('SHA-256 checksum of the immutable content, encoded as 64 lowercase hexadecimal characters.'),
    snapshotId: z.uuid().describe('Identifier of the immutable report snapshot.'),
    snapshotHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .describe('SHA-256 checksum binding this request to the exact report snapshot.'),
    operationId: z
      .uuid()
      .describe('UUID identifying one idempotent operation; changed input requires a new identifier.'),
    approvalId: z.uuid().optional().describe('Persisted broker approval identifier; absent for drafts.'),
    retrievalReference: z
      .string()
      .min(1)
      .describe('Provider-owned locator used to retrieve and verify artifact bytes.'),
  })
  .strict()
  .refine(
    a => (a.stage === 'draftOutput' ? a.approvalId === undefined : a.approvalId !== undefined),
    'Drafts cannot carry approval; approved output requires its approval binding.',
  );
export interface OutputProvider<C extends 'draftOutput' | 'reportOutput' | 'correctionOutput'> {
  /** Stable provider identifier used in registration and persisted provenance. */
  id: string;

  /** Provider category selecting its supported capture or output stage. */
  category: C;

  /** Supported capabilities required when resolving this provider registration. */
  capabilities: readonly string[];

  /** Create the stage-specific output and return its descriptor without granting approval. */
  materialize(
    request: import('./output-contracts.js').OutputRequest<C>,
    context: OperationContext & {
      /** Private directory used to materialize and retrieve output bytes. */
      outputDirectory: string;
    },
  ): Promise<z.infer<typeof outputArtifactSchema>>;

  /** Read artifact bytes for checksum verification and durable publication. */
  retrieve(
    artifact: z.infer<typeof outputArtifactSchema>,
    context: OperationContext & {
      /** Private directory used to materialize and retrieve output bytes. */
      outputDirectory: string;
    },
  ): Promise<Uint8Array>;
}
export type ProviderCategories = {
  /** Provider selected to capture immutable input sources. */
  input: InputProvider;

  /** Provider selected to materialize the immutable review draft. */
  draftOutput: OutputProvider<'draftOutput'>;

  /** Provider selected to materialize the approved final report. */
  reportOutput: OutputProvider<'reportOutput'>;

  /** Provider selected for an applicable proposed correction request. */
  correctionOutput: OutputProvider<'correctionOutput'>;
};

export type SavedSource =
  | Omit<
      Extract<
        CapturedSource,
        {
          kind: 'pdf';
        }
      >,
      'bytes'
    >
  | Extract<
      CapturedSource,
      {
        kind: 'records';
      }
    >;
