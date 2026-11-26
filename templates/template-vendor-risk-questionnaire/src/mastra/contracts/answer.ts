import type { CanonicalQuestion } from './question.ts';
import { z } from 'zod';
import { id } from './primitives.ts';
import { evidenceCitationSchema } from './evidence-citation.ts';

export const reasonSchema = z.enum([
  'MISSING_EVIDENCE',
  'PARTIAL_EVIDENCE',
  'CONFLICTING_EVIDENCE',
  'UNSUPPORTED_CLAIM',
  'INVALID_ATTRIBUTION',
  'SENSITIVE_DISCLOSURE',
  'UNSUPPORTED_COMMITMENT',
  'AMBIGUOUS_APPLICABILITY',
  'LOW_CONFIDENCE',
  'INCOMPATIBLE_RESPONSE',
  'INCONSISTENT_ANSWERS',
  'SOURCE_UNAVAILABLE',
  'PROVIDER_FAILURE',
  'AUTHENTICATION_FAILURE',
  'MODEL_UNAVAILABLE',
  'STORAGE_FAILURE',
  'BUDGET_EXHAUSTED',
  'TIME_LIMIT',
  'CALL_TIMEOUT',
  'TOKEN_LIMIT',
  'SECURITY_BLOCKED',
  'DETECTOR_FAILED',
  'INVALID_MODEL_OUTPUT',
]);
export type Reason = z.infer<typeof reasonSchema>;
export const interpretationSchema = z
  .object({
    domain: id,
    query: z.string().min(1).max(1000),
    subparts: z.array(z.string().min(1).max(500)).min(1).max(20),
    equivalenceKey: z.string().max(200),
    product: id,
    environment: id,
    timeQualifier: z.string().min(1).max(200),
  })
  .strict();
export const answerValueSchema = z.enum(['yes', 'no', 'partial', 'not_applicable', 'unknown', 'free_text']);
export const draftInvariantSchema = z.enum(['DRAFT_UNIQUENESS', 'DRAFT_CITATION_REFERENCE', 'DRAFT_ASSERTION']);
export const draftSchema = z
  .object({
    questionId: id,
    domain: id,
    value: answerValueSchema,
    text: z.string().max(4000),
    responseOption: z.string().max(200).nullable(),
    claims: z
      .array(
        z
          .object({
            id,
            text: z.string().min(1).max(1000),
            citationIds: z.array(id).min(1).max(20),
            kind: z.enum([
              'policy',
              'operational',
              'certification',
              'contractual',
              'numerical',
              'universal',
              'time_bound',
            ]),
          })
          .strict(),
      )
      .max(30),
    citations: z.array(evidenceCitationSchema).max(30),
    coveredSubparts: z.array(z.string().min(1).max(500)).max(20),
    confidence: z.number().min(0).max(1),
    limitations: z.array(z.string().min(1).max(500)).max(20),
  })
  .strict()
  .superRefine(refineDraft);
function refineDraft(
  v: {
    claims: Array<{ id: string; citationIds: string[] }>;
    citations: Array<{ id: string }>;
    coveredSubparts: string[];
    value: string;
    text: string;
    responseOption: string | null;
  },
  c: z.RefinementCtx,
) {
  if (
    new Set(v.claims.map(x => x.id)).size !== v.claims.length ||
    new Set(v.citations.map(x => x.id)).size !== v.citations.length ||
    new Set(v.coveredSubparts).size !== v.coveredSubparts.length
  )
    c.addIssue({
      code: 'custom',
      message: 'Draft identities and coverage must be unique.',
      params: { invariant: 'DRAFT_UNIQUENESS' },
    });
  if (v.claims.some(x => x.citationIds.some(id => !v.citations.some(c => c.id === id))))
    c.addIssue({
      code: 'custom',
      message: 'Claims require existing citation references.',
      params: { invariant: 'DRAFT_CITATION_REFERENCE' },
    });
  if (
    v.value === 'unknown'
      ? v.claims.length > 0 || v.citations.length > 0 || v.text !== '' || v.responseOption !== null
      : v.text.length === 0 || v.claims.length === 0
  )
    c.addIssue({
      code: 'custom',
      message: 'Factual answers require claims; unknown carries no factual assertion.',
      params: { invariant: 'DRAFT_ASSERTION' },
    });
}
export const verificationSchema = z
  .object({
    supportedClaimIds: z.array(id).max(30),
    conflictedClaimIds: z.array(id).max(30),
    unsupportedCommitment: z.boolean(),
    applicable: z.boolean(),
    complete: z.boolean(),
    sensitive: z.boolean(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      new Set(v.supportedClaimIds).size !== v.supportedClaimIds.length ||
      new Set(v.conflictedClaimIds).size !== v.conflictedClaimIds.length ||
      v.supportedClaimIds.some(x => v.conflictedClaimIds.includes(x))
    )
      c.addIssue({ code: 'custom', message: 'Verification claim sets must be unique and disjoint.' });
  });
// Model citations refer to returned excerpt IDs; trusted code attaches immutable source bindings.
export const draftResponseSchema = z
  .object({
    ...draftSchema.shape,
    citations: z
      .array(
        z
          .object({ id, excerptId: z.string().min(1).max(240), supportingExcerpt: z.string().min(1).max(4000) })
          .strict(),
      )
      .max(30),
  })
  .strict()
  .superRefine(refineDraft);
export const questionResultSchema = z
  .object({
    questionId: id,
    order: z.int().nonnegative(),
    draft: draftSchema.nullable(),
    interpretation: interpretationSchema.nullable(),
    status: z.enum(['draft_eligible', 'review_required', 'security_review_required']),
    reasons: z.array(reasonSchema).max(30),
    attempts: z.int().nonnegative(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      new Set(v.reasons).size !== v.reasons.length ||
      (v.draft && v.draft.questionId !== v.questionId) ||
      (v.status === 'draft_eligible'
        ? v.reasons.length !== 0 || !v.draft || v.draft.value === 'unknown'
        : v.reasons.length === 0) ||
      (v.status === 'security_review_required') !==
        v.reasons.some(r => r === 'SECURITY_BLOCKED' || r === 'DETECTOR_FAILED') ||
      (v.status === 'security_review_required' && v.draft !== null)
    )
      c.addIssue({ code: 'custom', message: 'Result identity and routing must agree.' });
  });
export type Interpretation = z.infer<typeof interpretationSchema>;
export type AnswerDraft = z.infer<typeof draftSchema>;
export type QuestionResult = z.infer<typeof questionResultSchema>;

// Draft generation and human corrections must fit the same questionnaire fields.
export function compatibleResponseSchema(question: CanonicalQuestion) {
  return z
    .object({
      value: draftSchema.shape.value,
      text: draftSchema.shape.text,
      responseOption: draftSchema.shape.responseOption,
    })
    .refine(
      draft => {
        if (question.answerConstraints.maxChars && draft.text.length > question.answerConstraints.maxChars)
          return false;
        if (draft.value === 'unknown') return true;
        if (question.answerType === 'free_text') return draft.responseOption === null;
        const aliases =
          draft.value === 'not_applicable'
            ? ['not_applicable', 'n/a', 'na']
            : draft.value === 'yes'
              ? ['yes', 'true', '1']
              : draft.value === 'no'
                ? ['no', 'false', '0']
                : [draft.value];
        return Boolean(
          question.answerConstraints.options?.some(
            option =>
              option.value === draft.responseOption &&
              (question.answerType === 'single_choice' || aliases.includes(option.value.toLowerCase())),
          ),
        );
      },
      { message: 'Response must fit the original question length, type and supplied choices.' },
    );
}
