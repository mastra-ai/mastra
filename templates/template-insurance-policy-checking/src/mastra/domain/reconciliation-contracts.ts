import { z } from 'zod';
import type { OperationContext } from './contracts.js';
import type { ProcessingAttempt } from '../storage/reconciliation.js';

const text = z.string().min(1).max(2000);
const decimal = z
  .string()
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/)
  .max(100);
function decimalLessOrEqual(left: string, right: string) {
  const scale = Math.max(left.split('.')[1]?.length ?? 0, right.split('.')[1]?.length ?? 0);
  const integer = (value: string) => {
    const [whole, fraction = ''] = value.split('.');
    return BigInt(`${whole}${fraction.padEnd(scale, '0')}`);
  };
  return integer(left) <= integer(right);
}
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
      type: z.literal('money'),
      amount: decimal,
      currency: z.string().regex(/^[A-Z]{3}$/),
      unit: text,
      basis: text,
      minimum: decimal.nullable(),
      maximum: decimal.nullable(),
    })
    .strict()
    .refine(
      value => value.minimum === null || value.maximum === null || decimalLessOrEqual(value.minimum, value.maximum),
      'Minimum must not exceed maximum.',
    ),
  z.object({ type: z.literal('number'), amount: decimal, unit: text, basis: text }).strict(),
  z
    .object({ type: z.literal('date'), value: date, granularity: z.enum(['year', 'month', 'day']) })
    .strict()
    .refine(
      value => value.value.length === { year: 4, month: 7, day: 10 }[value.granularity],
      'Date granularity must match the value.',
    ),
  z.object({ type: z.literal('entity'), name: text, address: text.nullable(), unit: text.nullable() }).strict(),
  z.object({ type: z.literal('text'), value: text }).strict(),
  z.object({ type: z.literal('clause'), wording: text, clauseId: text.nullable(), heading: text }).strict(),
]);
export const evidenceSchema = z
  .object({
    sourceId: z.uuid(),
    version: text,
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    physicalPage: z.number().int().positive().nullable(),
    recordId: text.nullable(),
    field: text.nullable(),
    excerpt: text,
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
    category: text,
    key: text,
    label: text,
    scope: text,
    value: termValueSchema,
    original: text,
    evidence: z.array(evidenceSchema).min(1).max(10),
    uncertainty: z.array(text).max(20),
  })
  .strict();
export const extractionSchema = z
  .object({
    sourceId: z.uuid(),
    terms: z.array(termSchema).max(300),
    reviewedPages: z.array(z.number().int().positive()).max(1000),
    reviewedRecords: z.array(z.object({ recordId: text, field: text }).strict()).max(1000),
    complete: z.boolean(),
    limitations: z.array(text).max(30),
    changes: z
      .array(
        z
          .object({
            category: text,
            key: text,
            scope: text,
            value: termValueSchema,
            policyNumber: text,
            effectiveFrom: date.refine(value => value.length === 10),
            effectiveTo: date.refine(value => value.length === 10).nullable(),
            approver: text,
            approvalStatement: text,
            evidence: z.array(evidenceSchema).min(1).max(10),
          })
          .strict()
          .refine(
            value => value.effectiveTo === null || value.effectiveFrom <= value.effectiveTo,
            'Amendment dates must be ordered.',
          ),
      )
      .max(100),
  })
  .strict()
  .superRefine((value, context) => {
    const keys = value.terms.map(term => `${term.category}\0${term.key}\0${term.scope}`);
    if (new Set(keys).size !== keys.length)
      context.addIssue({ code: 'custom', message: 'Duplicate terms need distinct documented scopes.' });
    if (new Set(value.reviewedPages).size !== value.reviewedPages.length)
      context.addIssue({ code: 'custom', message: 'Reviewed pages must be unique.' });
  });
export const semanticSchema = z
  .object({
    assessments: z
      .array(
        z
          .object({
            key: text,
            scope: text,
            category: text,
            conclusion: z.enum(['equivalent', 'different', 'uncertain']),
            observation: text,
            interpretation: text,
            uncertainty: z.array(text).max(20),
            evidence: z.array(evidenceSchema).min(2).max(20),
          })
          .strict(),
      )
      .max(300),
  })
  .strict();
export const compareRequestSchema = z
  .object({
    caseId: z.uuid(),
    expectedRevision: z.number().int().positive(),
    profileId: text,
    asOf: date.refine(value => value.length === 10),
    retryAttemptId: z.uuid().nullable(),
  })
  .strict();
export type CompareRequest = z.infer<typeof compareRequestSchema>;
export type TermValue = z.infer<typeof termValueSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Term = z.infer<typeof termSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
export type SemanticAssessment = z.infer<typeof semanticSchema>;
export type Classification = 'MATCH' | 'AUTHORIZED_CHANGE' | 'DISCREPANCY' | 'MISSING_EVIDENCE' | 'REQUIRES_REVIEW';
export type Comparison = {
  id: string;
  category: string;
  key: string;
  label: string;
  scope: string;
  baseline: Term | null;
  actual: Term | null;
  effectiveValue: TermValue | null;
  classification: Classification;
  evidence: Evidence[];
  searched: { sourceId: string; pages: number[]; records: { recordId: string; field: string }[]; complete: boolean }[];
  observation: string;
  interpretation: string;
  action: string;
  uncertainty: string[];
  severity: { level: 'High' | 'Medium' | 'Low'; rationale: string } | null;
  appliedChanges: Extraction['changes'];
};
export const processingBudgetSchema = z
  .object({
    maxAttempts: z.number().int().positive().max(10),
    maxRequests: z.number().int().positive().max(100),
    maxInputTokensPerRequest: z.number().int().positive(),
    maxOutputTokensPerRequest: z.number().int().positive(),
    maxTotalTokens: z.number().int().positive(),
    maxCostMicros: z.number().int().positive(),
    inputMicrosPerToken: z.number().int().nonnegative(),
    outputMicrosPerToken: z.number().int().nonnegative(),
    pricingAssumption: text,
    timeoutMs: z.number().int().min(1).max(120000),
    maxResponseBytes: z
      .number()
      .int()
      .positive()
      .max(16 * 1024 * 1024),
  })
  .strict()
  .refine(
    value => value.inputMicrosPerToken + value.outputMicrosPerToken > 0,
    'A conservative nonzero pricing assumption is required.',
  );
export type ProcessingBudget = z.infer<typeof processingBudgetSchema>;
export const comparisonResultSchema = z
  .object({
    analysisId: z.uuid(),
    attemptId: z.uuid(),
    workflowRunId: z.string().min(1),
    conclusion: z.enum(['OBSERVATIONS_AVAILABLE', 'INCOMPLETE']),
    comparisons: z.array(
      z
        .object({
          id: z.uuid(),
          label: text,
          classification: z.enum(['MATCH', 'AUTHORIZED_CHANGE', 'DISCREPANCY', 'MISSING_EVIDENCE', 'REQUIRES_REVIEW']),
          observation: text,
        })
        .strict(),
    ),
    limitations: z.array(text),
  })
  .strict();
export interface ComparisonRunner {
  compare(context: import('./contracts.js').OperationContext, input: unknown): Promise<unknown>;
}

export interface StructuredProcessingModel {
  generate<T>(
    context: OperationContext,
    attempt: ProcessingAttempt,
    stage: string,
    schema: z.ZodType<T>,
    data: unknown,
  ): Promise<T>;
}
