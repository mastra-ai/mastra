import { z } from 'zod';
import type { insuranceProfileSchema } from '../config/insurance-config.js';
import type { CaseRecord, OperationContext, SavedSource } from './case-contracts.js';
import type { Failure } from './operation-errors.js';

import { compareDecimals } from './decimal-utils.js';
import { termKey } from './term-utils.js';

const text = z.string().min(1).max(2000);
const decimal = z
  .string()
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/)
  .max(100);
const date = z
  .string()
  .regex(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/)
  .refine(value => {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || (month !== undefined && (month < 1 || month > 12))) return false;
    return day === undefined || (day > 0 && day <= new Date(Date.UTC(year, month!, 0)).getUTCDate());
  }, 'Use a real calendar date with its original granularity.');
export const termValueSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('money').describe('Discriminator selecting the documented value representation.'),
      amount: decimal.describe('Exact base-10 amount as a string; never use a floating-point number.'),
      currency: z
        .string()
        .regex(/^[A-Z]{3}$/)
        .describe('Three-letter uppercase currency code explicitly present in the original quotation.'),
      unit: text.describe('Documented comparison unit, such as each occurrence; null only where allowed.'),
      basis: text.describe(
        'Use fixed for an absolute amount, percentage for a stated percentage, or the literal documented basis.',
      ),
      minimum: decimal.nullable().describe('Documented minimum amount as an exact decimal string; null when absent.'),
      maximum: decimal.nullable().describe('Documented maximum amount as an exact decimal string; null when absent.'),
    })
    .strict()
    .refine(
      value => value.minimum === null || value.maximum === null || compareDecimals(value.minimum, value.maximum) <= 0,
      'Minimum must not exceed maximum.',
    ),
  z
    .object({
      type: z.literal('number').describe('Discriminator selecting the documented value representation.'),
      amount: decimal.describe('Exact base-10 amount as a string; never use a floating-point number.'),
      unit: text.describe('Documented comparison unit, such as each occurrence; null only where allowed.'),
      basis: text.describe(
        'Use fixed for an absolute amount, percentage for a stated percentage, or the literal documented basis.',
      ),
    })
    .strict(),
  z
    .object({
      type: z.literal('date').describe('Discriminator selecting the documented value representation.'),
      value: date.describe('Documented calendar date preserving YYYY, YYYY-MM or YYYY-MM-DD granularity.'),
      granularity: z.enum(['year', 'month', 'day']).describe('Precision of the original date: year, month or day.'),
    })
    .strict()
    .refine(
      value => value.value.length === { year: 4, month: 7, day: 10 }[value.granularity],
      'Date granularity must match the value.',
    ),
  z
    .object({
      type: z.literal('entity').describe('Discriminator selecting the documented value representation.'),
      name: text.describe('Documented entity name or registered profile name.'),
      address: text.nullable().describe('Documented entity address; null when absent.'),
      unit: text.nullable().describe('Documented comparison unit, such as each occurrence; null only where allowed.'),
    })
    .strict(),
  z
    .object({
      type: z.literal('text').describe('Discriminator selecting the documented value representation.'),
      value: text.describe('Exact supported textual term when a more specific typed representation is unavailable.'),
    })
    .strict(),
  z
    .object({
      type: z.literal('clause').describe('Discriminator selecting the documented value representation.'),
      wording: text.describe('Exact clause wording supported by the original quotation.'),
      clauseId: text.nullable().describe('Documented clause identifier; null when absent.'),
      heading: text.describe('Documented clause heading supported by the original quotation.'),
    })
    .strict(),
]);
export const evidenceSchema = z
  .object({
    sourceId: z.uuid().describe('Immutable captured source identifier; copy it exactly from the source.'),
    version: text.describe('Immutable version of this source or report.'),
    hash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .describe('SHA-256 checksum of the immutable content, encoded as 64 lowercase hexadecimal characters.'),
    physicalPage: z
      .number()
      .int()
      .positive()
      .nullable()
      .describe('One-based physical PDF page; null or absent for a record/field locator.'),
    recordId: text.nullable().describe('Captured record identifier; null or absent for a PDF page.'),
    field: text.nullable().describe('Captured field name within the identified record; null or absent for a PDF page.'),
    excerpt: text.describe(
      'Exact contiguous substring of the cited physical page or captured field; do not normalize or combine quotations.',
    ),
  })
  .strict()
  .refine(
    value =>
      value.physicalPage !== null
        ? value.recordId === null && value.field === null
        : value.recordId !== null && value.field !== null,
    'Use either a physical page or a record/field locator.',
  );
export const termSchema = z
  .object({
    category: text.describe('Term category used with key and scope to align comparisons.'),
    key: text.describe('Stable term key within its category and documented scope.'),
    label: text.describe('Human-readable term or finding label.'),
    scope: text.describe(
      'Documented applicability of the term; spacing and capitalization do not create another scope.',
    ),
    value: termValueSchema.describe(
      'Typed value supported by the original quotation, or the exact captured record value.',
    ),
    original: text.describe('Exact contiguous substring of one cited excerpt supporting every typed value component.'),
    evidence: z
      .array(evidenceSchema)
      .min(1)
      .max(10)
      .describe('Verifiable source quotations and their exact immutable locators.'),
    uncertainty: z.array(text).max(20).describe('Unresolved questions that prevent an unqualified interpretation.'),
  })
  .strict();
export const extractionObjectSchema = z
  .object({
    sourceId: z.uuid().describe('Immutable captured source identifier; copy it exactly from the source.'),
    terms: z
      .array(termSchema)
      .max(300)
      .describe(
        'Comparable operative insurance terms and policy identity facts, unique by category, key and normalized scope; exclude administrative provenance and general disclaimers.',
      ),
    reviewedPages: z
      .array(z.number().int().positive())
      .max(1000)
      .describe('Unique physical PDF page numbers actually reviewed; empty for structured records.'),
    reviewedRecords: z
      .array(
        z
          .object({
            recordId: text.describe('Captured record identifier; null or absent for a PDF page.'),
            field: text.describe('Captured field name within the identified record; null or absent for a PDF page.'),
          })
          .strict(),
      )
      .max(1000)
      .describe('Unique captured record/field locators actually reviewed; empty for PDFs.'),
    complete: z
      .boolean()
      .describe('Whether the stated review scope is complete; limitations still prevent overall assurance.'),
    limitations: z
      .array(text)
      .max(30)
      .describe(
        'Unresolved extraction, review or interpretation gaps that prevent reliable comparison, including missing relevant evidence. General disclaimers and administrative context belong in notes.',
      ),
    notes: z
      .array(text)
      .max(30)
      .default([])
      .describe(
        'Nonblocking document context preserved for broker review, such as preparation provenance, example labels and general authentication or legal disclaimers. Never move a genuine review gap, operative condition or conflicting term here.',
      ),
    changes: z
      .array(
        z
          .object({
            category: text.describe('Term category used with key and scope to align comparisons.'),
            key: text.describe('Stable term key within its category and documented scope.'),
            scope: text.describe(
              'Documented applicability of the term; spacing and capitalization do not create another scope.',
            ),
            value: termValueSchema.describe(
              'Typed value supported by the original quotation, or the exact captured record value.',
            ),
            policyNumber: text.describe('Policy identifier as documented; null when it is not established.'),
            effectiveFrom: date
              .refine(value => value.length === 10)
              .describe('First effective calendar date of the documented change, in YYYY-MM-DD format.'),
            effectiveTo: date
              .refine(value => value.length === 10)
              .nullable()
              .describe('Last effective calendar date, in YYYY-MM-DD format; null when no end is stated.'),
            approver: text.describe('Approver named in the documented change statement.'),
            approvalStatement: text.describe(
              'Exact source statement identifying affirmative approval, policy, term, scope and effective date.',
            ),
            evidence: z
              .array(evidenceSchema)
              .min(1)
              .max(10)
              .describe('Verifiable source quotations and their exact immutable locators.'),
          })
          .strict()
          .refine(
            value => value.effectiveTo === null || value.effectiveFrom <= value.effectiveTo,
            'Amendment dates must be ordered.',
          ),
      )
      .max(100)
      .describe('Documented changes requiring independent verification of approval, scope and effective dates.'),
  })
  .strict();
export const extractionSchema = extractionObjectSchema.superRefine((value, context) => {
  const keys = value.terms.map(termKey);
  if (new Set(keys).size !== keys.length)
    context.addIssue({ code: 'custom', message: 'Duplicate terms need distinct documented scopes.' });
  if (new Set(value.reviewedPages).size !== value.reviewedPages.length)
    context.addIssue({ code: 'custom', message: 'Reviewed pages must be unique.' });
  if (
    new Set(value.reviewedRecords.map(item => JSON.stringify([item.recordId, item.field]))).size !==
    value.reviewedRecords.length
  )
    context.addIssue({
      code: 'custom',
      path: ['reviewedRecords'],
      message: 'Reviewed record/field locators must be unique.',
    });
});
export const semanticSchema = z
  .object({
    assessments: z
      .array(
        z
          .object({
            key: text.describe('Stable term key within its category and documented scope.'),
            scope: text.describe(
              'Documented applicability of the term; spacing and capitalization do not create another scope.',
            ),
            category: text.describe('Term category used with key and scope to align comparisons.'),
            conclusion: z
              .enum(['equivalent', 'different', 'uncertain'])
              .describe('Bounded analytical conclusion; uncertainty and incomplete evidence remain explicit.'),
            observation: text.describe('Evidence-based statement of the observed result.'),
            interpretation: text.describe('Interpretation kept separate from the directly observed facts.'),
            uncertainty: z
              .array(text)
              .max(20)
              .describe('Unresolved questions that prevent an unqualified interpretation.'),
            evidence: z
              .array(evidenceSchema)
              .min(2)
              .max(20)
              .describe('Verifiable source quotations and their exact immutable locators.'),
          })
          .strict(),
      )
      .max(300)
      .describe('One semantic assessment per aligned clause pair and documented scope.'),
  })
  .strict()
  .refine(
    value => new Set(value.assessments.map(termKey)).size === value.assessments.length,
    'Each clause may have only one assessment within its documented scope.',
  );
export const compareRequestSchema = z
  .object({
    caseId: z.uuid().describe('Identifier of the case selected in this conversation.'),
    expectedRevision: z
      .number()
      .int()
      .positive()
      .describe('Latest case revision observed by the caller; rejects stale updates.'),
    profileId: text.describe('Registered insurance profile identifier to freeze with the analysis.'),
    asOf: date
      .refine(value => value.length === 10)
      .describe('Comparison date in YYYY-MM-DD format for applying documented effective intervals.'),
    retryAttemptId: z
      .uuid()
      .nullable()
      .describe('Failed attempt identifier for an explicit retry of unchanged input; null for a new analysis.'),
  })
  .strict();
export type CompareRequest = z.infer<typeof compareRequestSchema>;
export type TermValue = z.infer<typeof termValueSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Term = z.infer<typeof termSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
export type SemanticAssessment = z.infer<typeof semanticSchema>;
export const classificationSchema = z.enum([
  'MATCH',
  'AUTHORIZED_CHANGE',
  'DISCREPANCY',
  'MISSING_EVIDENCE',
  'REQUIRES_REVIEW',
]);
export const comparisonSchema = z
  .object({
    id: z.uuid().describe('Stable identifier of this persisted entity.'),
    category: z.string().min(1).describe('Term category used with key and scope to align comparisons.'),
    key: z.string().min(1).describe('Stable term key within its category and documented scope.'),
    label: z.string().min(1).describe('Human-readable term or finding label.'),
    scope: z
      .string()
      .min(1)
      .describe('Documented applicability of the term; spacing and capitalization do not create another scope.'),
    baseline: termSchema.nullable().describe('Typed reference term; null when it was not established.'),
    actual: termSchema.nullable().describe('Typed target term; null when it was not established.'),
    effectiveValue: termValueSchema
      .nullable()
      .describe('Reference value after verified applicable changes; null when unavailable.'),
    classification: classificationSchema.describe(
      'Machine classification preserving matches, changes, discrepancies and unresolved evidence.',
    ),
    evidence: z.array(evidenceSchema).describe('Verifiable source quotations and their exact immutable locators.'),
    searched: z
      .array(
        z
          .object({
            sourceId: z.uuid().describe('Immutable captured source identifier; copy it exactly from the source.'),
            pages: z
              .array(z.number().int().positive())
              .describe('Unique reviewed physical page numbers; empty for a structured-record scope.'),
            records: z
              .array(
                z
                  .object({
                    recordId: z.string().describe('Captured record identifier; null or absent for a PDF page.'),
                    field: z
                      .string()
                      .describe('Captured field name within the identified record; null or absent for a PDF page.'),
                  })
                  .strict(),
              )
              .describe('Unique reviewed record/field locators; empty for a PDF scope.'),
            complete: z
              .boolean()
              .describe('Whether the stated review scope is complete; limitations still prevent overall assurance.'),
          })
          .strict(),
      )
      .describe('Reviewed source scopes supporting this finding, including absence claims.'),
    observation: z.string().min(1).describe('Evidence-based statement of the observed result.'),
    interpretation: z.string().describe('Interpretation kept separate from the directly observed facts.'),
    action: z.string().describe('Suggested broker follow-up; never authorizes delivery or approval.'),
    uncertainty: z.array(z.string()).describe('Unresolved questions that prevent an unqualified interpretation.'),
    severity: z
      .object({
        level: z.enum(['High', 'Medium', 'Low']).describe('Broker review priority: High, Medium or Low.'),
        rationale: z.string().min(1).describe('Evidence-based explanation for the assigned review priority.'),
      })
      .strict()
      .nullable()
      .describe('Review priority and its documented rationale; null when not assigned.'),
    appliedChanges: extractionObjectSchema.shape.changes.describe(
      'Verified documented changes applied to the effective reference value.',
    ),
  })
  .strict();
export type Classification = z.infer<typeof classificationSchema>;
export type Comparison = z.infer<typeof comparisonSchema>;
export const processingBudgetSchema = z
  .object({
    maxAttempts: z
      .number()
      .int()
      .positive()
      .max(10)
      .describe(
        'Maximum attempts sharing the same approved budget, including explicit retries and evidence revisions.',
      ),
    maxRequests: z
      .number()
      .int()
      .positive()
      .max(100)
      .describe('Maximum actual provider requests covered by this approved allocation.'),
    maxInputTokensPerRequest: z
      .number()
      .int()
      .positive()
      .describe('Conservative input-token ceiling for each provider request.'),
    maxOutputTokensPerRequest: z
      .number()
      .int()
      .positive()
      .describe('Maximum output tokens reserved and requested per generation.'),
    maxTotalTokens: z.number().int().positive().describe('Aggregate reserved input and output token ceiling.'),
    maxCostMicros: z
      .number()
      .int()
      .positive()
      .describe('Aggregate cost ceiling in millionths of the configured pricing currency.'),
    inputMicrosPerToken: z
      .number()
      .int()
      .nonnegative()
      .describe('Conservative input-token price in millionths of the configured pricing currency.'),
    outputMicrosPerToken: z
      .number()
      .int()
      .nonnegative()
      .describe('Conservative output-token price in millionths of the configured pricing currency.'),
    pricingAssumption: text.describe(
      'Description of the pricing source and assumptions behind the conservative estimate.',
    ),
    timeoutMs: z
      .number()
      .int()
      .min(1)
      .max(240000)
      .describe('Per-generation processing deadline in milliseconds, from 1 to 240000.'),
    maxResponseBytes: z
      .number()
      .int()
      .positive()
      .max(16 * 1024 * 1024)
      .describe('Maximum raw provider response size in bytes before SDK parsing.'),
  })
  .strict()
  .refine(
    value => value.inputMicrosPerToken + value.outputMicrosPerToken > 0,
    'A conservative nonzero pricing assumption is required.',
  );
export type ProcessingBudget = z.infer<typeof processingBudgetSchema>;
export const comparisonResultSchema = z
  .object({
    analysisId: z.uuid().describe('Identifier of the persisted evidence-backed analysis.'),
    attemptId: z.uuid().describe('Identifier of the processing attempt that produced this result.'),
    workflowRunId: z.string().min(1).describe('Native Mastra workflow run bound to this analysis or report.'),
    conclusion: z
      .enum(['OBSERVATIONS_AVAILABLE', 'INCOMPLETE'])
      .describe('Bounded analytical conclusion; uncertainty and incomplete evidence remain explicit.'),
    comparisons: z
      .array(
        z
          .object({
            id: z.uuid().describe('Stable identifier of this persisted entity.'),
            label: text.describe('Human-readable term or finding label.'),
            classification: z
              .enum(['MATCH', 'AUTHORIZED_CHANGE', 'DISCREPANCY', 'MISSING_EVIDENCE', 'REQUIRES_REVIEW'])
              .describe('Machine classification preserving matches, changes, discrepancies and unresolved evidence.'),
            observation: text.describe('Evidence-based statement of the observed result.'),
          })
          .strict(),
      )
      .describe('Evidence-backed findings for the selected reference and target.'),
    limitations: z
      .array(text)
      .describe('Known limits on extraction, review scope or interpretation; an empty array means none recorded.'),
  })
  .strict();
export interface ComparisonRunner {
  /** Run the authorized comparison through its persisted Mastra workflow. */
  compare(context: OperationContext, input: unknown): Promise<unknown>;
}

export interface StructuredProcessingModel {
  /** Generate one schema-validated result within the frozen attempt and approved budget. */
  generate<T>(
    context: OperationContext,
    attempt: ProcessingAttempt,
    stage: string,
    schema: z.ZodType<T>,
    data: unknown,
  ): Promise<T>;
}

export type AnalysisInput = {
  /** Version of the persisted contract used to interpret this snapshot. */
  schemaVersion: 'reconciliation-1';

  /** Identifier of the case selected in this conversation. */
  caseId: string;

  /** Case revision frozen when processing was authorized. */
  sourceRevision: number;

  /** Explicit broker statement of identity, intent, reference, target and source roles. */
  clarification: NonNullable<CaseRecord['clarification']>;

  /** Broker-declared policy identity, with unknown fields preserved as null. */
  identity: CaseRecord['identity'];

  /** Immutable sources captured for this case. */
  sources: SavedSource[];

  /** Insurance profile and version frozen for this analysis. */
  profile: z.infer<typeof insuranceProfileSchema>;

  /** Comparison date in YYYY-MM-DD format for applying documented effective intervals. */
  asOf: string;

  /** Approved model identifier used for structured processing. */
  model: string;

  /** Version of the structured extraction instructions. */
  promptVersion: 'insurance-2' | 'insurance-3' | 'insurance-4';

  /** Approved processing ceilings frozen with this authorized analysis. */
  budget: ProcessingBudget;
};
export type Analysis = {
  /** Stable identifier of this persisted entity. */
  id: string;

  /** Identifier of the processing attempt that produced this result. */
  attemptId: string;

  /** SHA-256 checksum binding the analysis to its frozen input. */
  inputHash: string;

  /** Immutable analysis input, including sources, profile, model and budget. */
  input: AnalysisInput;

  /** UTC timestamp when this immutable record was created. */
  createdAt: string;

  /** Verified structured extractions retained for each captured source. */
  extractions: Extraction[];

  /** Evidence-backed findings for the selected reference and target. */
  comparisons: Comparison[];

  /** Structured semantic assessments of aligned changed clauses. */
  semantic: SemanticAssessment;

  /** Profile-rule observations kept separate from contractual evidence. */
  rules: {
    /** Registered insurance profile identifier to freeze with the analysis. */
    profileId: string;

    /** Immutable version of this source or report. */
    version: string;

    /** Identifier of the configured profile rule. */
    ruleId: string;

    /** Evidence-based statement of the observed result. */
    observation: string;
  }[];

  /** Known limits on extraction, review scope or interpretation; an empty array means none recorded. */
  limitations: string[];

  /** Bounded analytical conclusion; uncertainty and incomplete evidence remain explicit. */
  conclusion: 'OBSERVATIONS_AVAILABLE' | 'INCOMPLETE';
};
export type ProcessingAttempt = {
  /** Stable identifier of this persisted entity. */
  id: string;

  /** Identifier of the case selected in this conversation. */
  caseId: string;

  /** Workflow or evaluation run identifier used for correlation. */
  runId: string;

  /** Shared allocation identifier preserved across explicit retries and evidence revisions. */
  budgetKey: string;

  /** SHA-256 checksum binding the analysis to its frozen input. */
  inputHash: string;

  /** Immutable analysis input, including sources, profile, model and budget. */
  input: AnalysisInput;

  /** Persisted lifecycle state of this entity. */
  state: 'PROCESSING' | 'COMPLETED' | 'FAILED';

  /** UTC timestamp when this processing attempt started. */
  startedAt: string;

  /** UTC timestamp of the last request reservation used for bounded recovery. */
  heartbeatAt: string;

  /** Safe recorded failure; null or absent when no failure is recorded. */
  failure: Failure | null;

  /** Identifier of the persisted evidence-backed analysis. */
  analysisId: string | null;
};
