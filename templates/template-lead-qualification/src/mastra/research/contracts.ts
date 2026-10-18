import { z } from 'zod';
import { domainSchema } from '../contracts';
import {
  outcomes,
  signalTypes,
  snapshotSchema,
  businessModelLabelSchema,
  researchTargetSchema,
} from '../config/qualification';

export const branchSchema = z.enum(['firmographics', 'signals']);
export type ResearchBranch = z.infer<typeof branchSchema>;
export const identitySchema = z
  .strictObject({
    status: z.enum(['resolved', 'ambiguous', 'unresolved']),
    domain: domainSchema.nullable(),
    companyName: z.string().max(200).nullable(),
    candidates: z.array(z.string().max(253)).max(10),
    reason: z.string().max(500),
  })
  .refine(value => value.status !== 'resolved' || value.domain !== null, 'Resolved identity requires a company domain');
export type CompanyIdentity = z.infer<typeof identitySchema>;
export const evidenceSchema = z.strictObject({
  id: z.string().min(1).max(100),
  kind: z.enum(['website', 'submitted', 'crm']),
  source: z.string().min(1).max(2048),
  title: z.string().max(200),
  retrievedAt: z.iso.datetime({ offset: true }),
  publishedAt: z.iso.datetime({ offset: true }).nullable(),
  excerpt: z.string().min(1).max(24_000),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  providerId: z.string().min(1).max(100),
  retrieval: z.enum(['page', 'submitted', 'api']),
});
export type Evidence = z.infer<typeof evidenceSchema>;
export const discoverySchema = z.strictObject({
  sourceUrls: z.array(z.string().min(1).max(2048)).max(100),
  evidence: z.array(evidenceSchema).max(20),
});
export const employeeIntervalSchema = z
  .strictObject({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative().nullable() })
  .refine(value => value.max === null || value.min <= value.max);
export type EmployeeInterval = z.infer<typeof employeeIntervalSchema>;
export const signalSchema = z.strictObject({
  type: z.enum(signalTypes),
  occurredAt: z.iso.datetime({ offset: true }).nullable(),
});
export const supportingPassageSchema = z.strictObject({
  evidenceId: z.string().min(1).max(100),
  quote: z.string().min(1).max(2000),
});
export const inferenceSchema = z.strictObject({
  rationale: z.string().trim().min(1).max(2000),
  additionalPassages: z.array(supportingPassageSchema).max(3),
});
export const candidateSchema = z
  .strictObject({
    id: z.string().min(1).max(100),
    attribute: z.enum(['businessModel', 'employeeCount', 'headquartersCountry', 'buyingIntent']),
    value: z.union([businessModelLabelSchema, employeeIntervalSchema, z.string().regex(/^[A-Z]{2}$/), signalSchema]),
    evidenceId: z.string().min(1).max(100),
    quote: z.string().min(1).max(2000),
    asOf: z.iso.datetime({ offset: true }).nullable(),
    inference: inferenceSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const schema = {
      businessModel: businessModelLabelSchema,
      employeeCount: employeeIntervalSchema,
      headquartersCountry: z.string().regex(/^[A-Z]{2}$/),
      buyingIntent: signalSchema,
    }[value.attribute];
    if (!schema.safeParse(value.value).success)
      ctx.addIssue({ code: 'custom', message: 'Candidate value must match its attribute' });
    if (value.inference && !['businessModel', 'employeeCount'].includes(value.attribute))
      ctx.addIssue({ code: 'custom', message: 'Only business model and employee count may be inferred' });
    if (
      value.attribute === 'employeeCount' &&
      value.inference &&
      employeeIntervalSchema.safeParse(value.value).data?.max === null
    )
      ctx.addIssue({ code: 'custom', message: 'Inferred employee estimates require a finite upper bound' });
    const passages = [
      { evidenceId: value.evidenceId, quote: value.quote },
      ...(value.inference?.additionalPassages ?? []),
    ];
    if (new Set(passages.map(passage => JSON.stringify(passage))).size !== passages.length)
      ctx.addIssue({ code: 'custom', message: 'Supporting passages must be distinct' });
  });
export type Candidate = z.infer<typeof candidateSchema>;
export function candidatePassages(candidate: Candidate) {
  return [
    { evidenceId: candidate.evidenceId, quote: candidate.quote },
    ...(candidate.inference?.additionalPassages ?? []),
  ];
}
export const acceptedInferenceSchema = z
  .strictObject({
    candidateId: z.string().min(1).max(100),
    attribute: z.enum(['businessModel', 'employeeCount']),
    value: z.union([businessModelLabelSchema, employeeIntervalSchema]),
    rationale: inferenceSchema.shape.rationale,
    passages: z.array(supportingPassageSchema).min(1).max(4),
  })
  .refine(
    value =>
      value.attribute === 'businessModel'
        ? businessModelLabelSchema.safeParse(value.value).success
        : employeeIntervalSchema.safeParse(value.value).success &&
          employeeIntervalSchema.parse(value.value).max !== null,
    'Inference value must match its attribute',
  );
export const candidateRejectionSchema = z
  .strictObject({
    branch: branchSchema,
    candidateId: z.string().regex(/^candidate-[a-f0-9]{24}$/),
    evidenceId: z.string().regex(/^evidence-[a-f0-9]{24}$/),
    attribute: candidateSchema.shape.attribute,
    value: candidateSchema.shape.value,
    reason: z.enum([
      'unknown_evidence_id',
      'exact_quote_absent',
      'semantic_verification_rejected',
      'unconfigured_business_model',
      'candidate_provenance_invalid',
    ]),
    checks: z.strictObject({
      evidenceKnown: z.boolean(),
      exactQuotePresent: z.boolean(),
      semanticSupported: z.boolean(),
      configuredLabel: z.boolean().optional(),
      provenanceValid: z.boolean().optional(),
    }),
  })
  .refine(
    value =>
      candidateSchema.safeParse({
        id: 'candidate',
        evidenceId: 'evidence',
        quote: 'quote',
        asOf: null,
        attribute: value.attribute,
        value: value.value,
      }).success,
    'Rejected candidate value must match its attribute',
  );
export const extractionSchema = z
  .strictObject({
    companyName: z.string().max(200).nullable(),
    identityAmbiguous: z.boolean(),
    candidates: z.array(candidateSchema).max(30),
    intentCoverageComplete: z.boolean(),
  })
  .refine(
    value => new Set(value.candidates.map(candidate => candidate.id)).size === value.candidates.length,
    'Candidate IDs must be unique',
  );
export const verificationSchema = z.strictObject({
  supportedCandidateIds: z.array(z.string().max(100)).max(30),
  intentCoverageComplete: z.boolean(),
});
export const pageFailureSchema = z.strictObject({
  phase: z.enum(['content_length_malformed', 'declared_too_large', 'compressed_overflow', 'decoded_overflow']),
  declaredLength: z.number().int().nonnegative().nullable(),
  encoding: z.enum(['identity', 'gzip', 'br', 'deflate', 'other']),
  observedCompressedBytes: z.number().int().nonnegative(),
  observedDecodedBytes: z.number().int().nonnegative(),
  byteCap: z.number().int().positive(),
});
export type PageFailure = z.infer<typeof pageFailureSchema>;
export const failureSchema = z.strictObject({
  branch: branchSchema,
  providerId: z.string().max(100),
  code: z.string().regex(/^[a-z_]{1,80}$/),
  retryable: z.boolean(),
  page: pageFailureSchema.optional(),
});
export type ResearchFailure = z.infer<typeof failureSchema>;
export const branchResultSchema = z.strictObject({
  branch: branchSchema,
  // Ten configured providers may each return twenty sources and thirty candidates,
  // plus two retrieved page contents. Failures also cover source validation and GET attempts.
  evidence: z.array(evidenceSchema).max(202),
  candidates: z.array(candidateSchema).max(300),
  rejections: z.array(candidateRejectionSchema).max(300),
  failures: z.array(failureSchema).max(1500),
  analysisComplete: z.boolean(),
  intentCoverageComplete: z.boolean(),
  identityAmbiguous: z.boolean(),
  companyName: z.string().max(200).nullable(),
});
export type BranchResult = z.infer<typeof branchResultSchema>;
export const gapSchema = z.enum([
  'resolved',
  'no_count_observed',
  'lower_bound_only',
  'estimate_requires_review',
  'boundary_overlap',
  'content_unavailable',
  'rejected',
  'conflict',
  'stale',
  'budget',
  'unresolved',
]);
export const roundDiagnosticSchema = z.strictObject({
  index: z.number().int().min(0).max(9),
  target: researchTargetSchema,
  reason: z.enum(['completed', 'already_supported', 'budget_exhausted']),
  gap: gapSchema,
  urls: z
    .array(
      z.strictObject({ url: z.url().max(2048), outcome: z.enum(['retrieved', 'unavailable', 'already_consulted']) }),
    )
    .max(100),
  missingBefore: z.array(researchTargetSchema).max(4),
  missingAfter: z.array(researchTargetSchema).max(4),
  discoveredUrls: z.number().int().min(0).max(1000),
  retrievedPages: z.number().int().min(0).max(100),
  extractedCandidates: z.number().int().min(0).max(300),
  selectedCandidates: z.number().int().min(0).max(300),
  acceptedCandidates: z.number().int().min(0).max(300),
  rejectedCandidates: z.number().int().min(0).max(300),
  searchCalls: z.number().int().min(0).max(100),
  pageRequests: z.number().int().min(0).max(100),
});
export const researchRoundSchema = z
  .strictObject({ result: branchResultSchema, diagnostic: roundDiagnosticSchema })
  .refine(
    ({ result, diagnostic }) =>
      result.branch === (diagnostic.target === 'buyingIntent' ? 'signals' : 'firmographics') &&
      diagnostic.acceptedCandidates === result.candidates.length &&
      diagnostic.rejectedCandidates === result.rejections.length &&
      diagnostic.selectedCandidates <= diagnostic.extractedCandidates &&
      diagnostic.acceptedCandidates + diagnostic.rejectedCandidates <= diagnostic.selectedCandidates &&
      diagnostic.retrievedPages <= diagnostic.pageRequests,
    'Round diagnostics must match the persisted result and processing counts',
  );
export type ResearchRound = z.infer<typeof researchRoundSchema>;
export const factSchema = z
  .strictObject({
    disposition: z.enum(['accepted', 'missing', 'conflicting', 'unsupported', 'stale']),
    value: z.union([z.string(), employeeIntervalSchema, z.array(signalSchema)]).nullable(),
    evidenceIds: z.array(z.string()),
    candidateIds: z.array(z.string()),
    freshness: z.enum(['current', 'stale', 'unknown']),
    basis: z.enum(['observed', 'inferred']),
  })
  .refine(
    value => value.disposition !== 'accepted' || (value.value !== null && value.evidenceIds.length > 0),
    'Accepted facts require a value and supporting evidence',
  );
export type Fact = z.infer<typeof factSchema>;
export const factsSchema = z.strictObject({
  businessModel: factSchema.refine(
    fact => fact.value === null || businessModelLabelSchema.safeParse(fact.value).success,
  ),
  employeeCount: factSchema.refine(fact => fact.value === null || employeeIntervalSchema.safeParse(fact.value).success),
  headquartersCountry: factSchema.refine(
    fact =>
      fact.value === null ||
      z
        .string()
        .regex(/^[A-Z]{2}$/)
        .safeParse(fact.value).success,
  ),
  buyingIntent: factSchema.refine(fact => fact.value === null || z.array(signalSchema).safeParse(fact.value).success),
});
export const roundInputSchema = z.strictObject({
  index: z.number().int().min(0).max(9),
  target: researchTargetSchema,
  missingAttributes: z
    .array(researchTargetSchema)
    .max(4)
    .refine(values => new Set(values).size === values.length),
  gap: gapSchema,
  supportedFacts: factsSchema
    .partial()
    .refine(facts => Object.values(facts).every(fact => fact.disposition === 'accepted')),
  currentEvidenceIds: z.array(z.string().min(1).max(100)).max(2020),
  previousEvidenceIds: z.array(z.string().min(1).max(100)).max(2020),
});
export const scoreSchema = z.strictObject({
  score: z.number().int().min(0).max(100),
  classification: z.enum(outcomes),
  requiresReview: z.boolean(),
  contributions: z
    .array(
      z.strictObject({
        rule: z.enum(['businessModel', 'employeeCount', 'headquartersCountry', 'buyingIntent']),
        points: z.number().int().min(0).max(100),
        state: z.enum(['matched', 'mismatched', 'unknown', 'no_signal']),
        reason: z.string(),
      }),
    )
    .length(4),
  reviewReasons: z.array(z.string()),
  nextAction: z.string(),
});
export const assessmentSchema = z.strictObject({
  id: z.uuid(),
  runId: z.uuid(),
  version: z.literal(1),
  processingStatus: z.enum(['completed', 'failed']),
  snapshot: snapshotSchema,
  identity: identitySchema,
  facts: factsSchema,
  evidence: z.array(evidenceSchema).max(2021),
  failures: z.array(failureSchema).max(15000),
  rejections: z.array(candidateRejectionSchema).max(3000),
  inferences: z.array(acceptedInferenceSchema).max(3000),
  rounds: z.array(roundDiagnosticSchema).max(10),
  result: scoreSchema,
  summary: z.string().min(1).max(10_000),
  completedAt: z.iso.datetime({ offset: true }),
});
export type Assessment = z.infer<typeof assessmentSchema>;

export class ResearchError extends Error {
  constructor(
    readonly code: string,
    readonly retryable = false,
    readonly retryAfterMs = 0,
    readonly page?: PageFailure,
  ) {
    super(code);
  }
}
