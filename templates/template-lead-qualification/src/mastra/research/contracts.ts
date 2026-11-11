import { z } from 'zod';
import { domainSchema } from '../contracts';
import { selectionDiagnosticUrl } from '../observability/selection-diagnostics';
import { diagnosticTextLimit, safeDiagnosticText } from '../observability/evidence-diagnostics';
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
export const discoverySchema = z
  .strictObject({
    sourceUrls: z.array(z.string().min(1).max(2048)).max(100),
    preferredSourceUrls: z.array(z.string().min(1).max(2048)).max(100).optional(),
    evidence: z.array(evidenceSchema).max(20),
  })
  .refine(
    discovery => discovery.preferredSourceUrls?.every(url => discovery.sourceUrls.includes(url)) ?? true,
    'Preferred source URLs must be a subset of discovered source URLs',
  );
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
const candidateFields = {
  id: z.string().min(1).max(100),
  evidenceId: z.string().min(1).max(100),
  quote: z.string().min(1).max(2000),
  asOf: z.iso
    .datetime({ offset: true })
    .nullable()
    .describe(
      'Fact effective date explicitly supported by the cited content; null when undated. Never copy retrieval or assessment timestamps.',
    ),
};
const headquartersCountrySchema = z.string().regex(/^[A-Z]{2}$/);
const inferredEmployeeIntervalSchema = employeeIntervalSchema.safeExtend({ max: employeeIntervalSchema.shape.min });
export const candidateValueSchema = z.union([
  businessModelLabelSchema,
  employeeIntervalSchema,
  headquartersCountrySchema,
  signalSchema,
]);
export const candidateSchema = z
  .union([
    z.strictObject({
      ...candidateFields,
      attribute: z.literal('businessModel'),
      value: businessModelLabelSchema,
      inference: inferenceSchema.nullable().optional(),
    }),
    z.strictObject({
      ...candidateFields,
      attribute: z.literal('employeeCount'),
      value: employeeIntervalSchema,
      inference: z.null().optional(),
    }),
    z.strictObject({
      ...candidateFields,
      attribute: z.literal('employeeCount'),
      value: inferredEmployeeIntervalSchema,
      inference: inferenceSchema,
    }),
    z.strictObject({
      ...candidateFields,
      attribute: z.literal('headquartersCountry'),
      value: headquartersCountrySchema,
      inference: z.null().optional(),
    }),
    z.strictObject({
      ...candidateFields,
      attribute: z.literal('buyingIntent'),
      value: signalSchema,
      inference: z.null().optional(),
    }),
  ])
  .superRefine((value, ctx) => {
    const passages = [
      { evidenceId: value.evidenceId, quote: value.quote },
      ...(value.inference?.additionalPassages ?? []),
    ];
    if (new Set(passages.map(passage => JSON.stringify(passage))).size !== passages.length)
      ctx.addIssue({
        code: 'custom',
        path: ['inference', 'additionalPassages'],
        message: 'Supporting passages must be distinct',
      });
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
const rejectedTextDiagnosticSchema = z
  .strictObject({
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    length: z.number().int().min(1).max(2000),
    publicText: z.string().min(1).max(diagnosticTextLimit).refine(safeDiagnosticText).nullable(),
    omission: z.enum(['not_public_literal', 'private_overlap', 'sensitive_content']).nullable(),
  })
  .refine(
    value =>
      (value.publicText === null) === (value.omission !== null) &&
      (value.publicText === null || value.publicText.length <= value.length),
    'Diagnostic text must be bounded or explicitly omitted',
  );
export const rejectedEvidenceDiagnosticSchema = z
  .strictObject({
    version: z.literal(1),
    verificationContract: z.literal('supported_candidate_ids'),
    passages: z
      .array(
        z
          .strictObject({
            evidenceId: z.string().regex(/^evidence-[a-f0-9]{40}$/),
            evidenceDigest: z.string().regex(/^[a-f0-9]{64}$/),
            sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
            evidenceLength: z.number().int().min(1).max(24_000),
            quote: rejectedTextDiagnosticSchema,
            exactQuotePresent: z.boolean(),
            whitespaceNormalizedMatch: z.boolean(),
            unicodeNormalizedMatch: z.boolean(),
            typographyNormalizedMatch: z.boolean(),
          })
          .refine(
            value => value.exactQuotePresent || value.quote.publicText === null,
            'Nonliteral proposals cannot retain public text',
          ),
      )
      .min(1)
      .max(4),
    rationale: rejectedTextDiagnosticSchema.nullable(),
  })
  .refine(
    value => JSON.stringify(value).length <= 4096,
    'Rejected evidence diagnostics must fit within 4096 characters',
  );
export const candidateRejectionSchema = z
  .strictObject({
    branch: branchSchema,
    candidateId: z.string().regex(/^candidate-[a-f0-9]{24}$/),
    evidenceId: z.string().regex(/^evidence-[a-f0-9]{24}$/),
    attribute: researchTargetSchema,
    value: candidateValueSchema,
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
    diagnostic: rejectedEvidenceDiagnosticSchema.optional(),
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
    identityAmbiguous: z.boolean(),
    candidates: z.array(candidateSchema).max(30),
    intentCoverageComplete: z.boolean(),
  })
  .refine(
    value => new Set(value.candidates.map(candidate => candidate.id)).size === value.candidates.length,
    'Candidate IDs must be unique',
  );
export const verifierReasonSchema = z.enum([
  'supported_observation',
  'supported_inference',
  'quote_not_exact',
  'source_not_relevant',
  'value_not_supported',
  'effective_date_not_supported',
  'inference_not_supported',
  'uncertainty_missing',
  'unsupported_restatement',
  'insufficient_support',
]);
export const verifierDecisionFields = {
  candidateId: z.string().min(1).max(100),
  decision: z.enum(['supported', 'rejected']),
  reasonCode: verifierReasonSchema,
  passageIndexes: z.array(z.number().int().min(0).max(3)).max(4),
};
export const verifierDecisionSchema = z
  .strictObject(verifierDecisionFields)
  .refine(
    value =>
      new Set(value.passageIndexes).size === value.passageIndexes.length &&
      (value.decision === 'supported') === value.reasonCode.startsWith('supported_') &&
      (value.decision !== 'supported' || value.passageIndexes.length > 0),
    'Diagnostic decision, reason and unique passage indexes must agree',
  );
export const verifierDecisionsSchema = z
  .array(verifierDecisionSchema)
  .max(30)
  .refine(
    values => new Set(values.map(value => value.candidateId)).size === values.length,
    'Diagnostic candidate IDs must be unique',
  );
// Diagnostic validation is independent: malformed optional metadata cannot change semantic authority.
export const verificationSchema = z.strictObject({
  supportedCandidateIds: z.array(z.string().max(100)).max(30),
  intentCoverageComplete: z.boolean(),
  diagnostics: z.unknown().optional(),
});
// Strict JSON output requires every property; legacy/custom responses can still omit diagnostics.
export const verificationWireSchema = verificationSchema.extend({
  diagnostics: z.array(z.strictObject(verifierDecisionFields)).max(30).nullable(),
});
export const verifierLedgerSchema = z
  .strictObject({
    version: z.literal(1),
    candidateId: z.string().regex(/^candidate-[a-f0-9]{24}$/),
    providerId: z.string().min(1).max(100),
    roundIndex: z.number().int().min(0).max(9),
    branch: branchSchema,
    attribute: researchTargetSchema,
    verifierSupported: z.boolean(),
    candidateInferred: z.boolean().optional(),
    modelReport: z
      .strictObject({ decision: verifierDecisionFields.decision, reasonCode: verifierReasonSchema })
      .refine(value => (value.decision === 'supported') === value.reasonCode.startsWith('supported_'))
      .nullable()
      .optional(),
    status: z.enum(['reported', 'missing', 'not_reported', 'invalid']),
    invalidCode: z
      .enum([
        'schema_invalid',
        'coverage_mismatch',
        'decision_mismatch',
        'support_membership_mismatch',
        'inference_kind_mismatch',
        'passage_invalid',
      ])
      .nullable(),
    decision: z.enum(['supported', 'rejected']).nullable(),
    reasonCode: verifierReasonSchema.nullable(),
    passages: z
      .array(
        z.strictObject({
          index: z.number().int().min(0).max(3),
          evidenceId: z.string().regex(/^evidence-[a-f0-9]{40}$/),
          evidenceDigest: z.string().regex(/^[a-f0-9]{64}$/),
          sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
          quoteDigest: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      )
      .max(4),
    privatePassagesOmitted: z.number().int().min(0).max(4),
  })
  .refine(
    value =>
      (value.status === 'invalid') === (value.invalidCode !== null) &&
      (value.status === 'reported'
        ? value.decision !== null &&
          value.reasonCode !== null &&
          value.verifierSupported === (value.decision === 'supported') &&
          (value.decision === 'supported') === value.reasonCode.startsWith('supported_')
        : value.decision === null &&
          value.reasonCode === null &&
          value.passages.length === 0 &&
          value.privatePassagesOmitted === 0) &&
      new Set(value.passages.map(passage => passage.index)).size === value.passages.length &&
      JSON.stringify(value).length <= 4096,
    'Persisted diagnostic status, authority, provenance and size must agree',
  )
  .refine(value => {
    const membershipMismatch = value.invalidCode === 'support_membership_mismatch';
    const inferenceMismatch = value.invalidCode === 'inference_kind_mismatch';
    if (value.modelReport === undefined) return !membershipMismatch && !inferenceMismatch;
    if (value.modelReport === null) return value.status !== 'reported' && !membershipMismatch && !inferenceMismatch;
    if (value.candidateInferred === undefined) return false;
    const membershipAgrees = value.verifierSupported === (value.modelReport.decision === 'supported');
    const inferenceAgrees =
      !value.verifierSupported || (value.modelReport.reasonCode === 'supported_inference') === value.candidateInferred;
    if (value.status === 'reported')
      return (
        membershipAgrees &&
        inferenceAgrees &&
        value.decision === value.modelReport.decision &&
        value.reasonCode === value.modelReport.reasonCode
      );
    if (value.status !== 'invalid') return false;
    if (membershipMismatch) return !membershipAgrees;
    if (inferenceMismatch) return membershipAgrees && !inferenceAgrees;
    if (value.invalidCode === 'decision_mismatch') return !membershipAgrees || !inferenceAgrees;
    return value.invalidCode === 'passage_invalid' && membershipAgrees && inferenceAgrees;
  }, 'Bounded model report must explain its diagnostic status without changing support authority');
export const pageFailureSchema = z.strictObject({
  phase: z.enum(['content_length_malformed', 'declared_too_large', 'compressed_overflow', 'decoded_overflow']),
  declaredLength: z.number().int().nonnegative().nullable(),
  encoding: z.enum(['identity', 'gzip', 'br', 'deflate', 'other']),
  observedCompressedBytes: z.number().int().nonnegative(),
  observedDecodedBytes: z.number().int().nonnegative(),
  byteCap: z.number().int().positive(),
});
export type PageFailure = z.infer<typeof pageFailureSchema>;
export const providerValidationIssueSchema = z.strictObject({
  code: z.enum([
    'invalid_type',
    'too_big',
    'too_small',
    'invalid_format',
    'not_multiple_of',
    'unrecognized_keys',
    'invalid_union',
    'invalid_key',
    'invalid_element',
    'invalid_value',
    'custom',
  ]),
  path: z
    .array(
      z.union([
        z.enum([
          'companyName',
          'identityAmbiguous',
          'candidates',
          'intentCoverageComplete',
          'supportedCandidateIds',
          'id',
          'attribute',
          'value',
          'evidenceId',
          'quote',
          'asOf',
          'inference',
          'rationale',
          'additionalPassages',
          'min',
          'max',
          'type',
          'occurredAt',
          'unknown_field',
        ]),
        z.number().int().nonnegative().max(30),
      ]),
    )
    .max(8),
});
export const providerFailureSchema = z.strictObject({
  stage: z.enum(['search', 'extract', 'verify']),
  validationIssues: z.array(providerValidationIssueSchema).max(8).optional(),
  responseStatus: z.enum(['completed', 'incomplete', 'failed', 'cancelled', 'queued', 'in_progress']).optional(),
  incompleteReason: z.enum(['max_output_tokens', 'content_filter']).optional(),
  httpStatus: z.number().int().min(100).max(599).optional(),
  errorClass: z
    .enum([
      'api_call',
      'retry',
      'json_parse',
      'type_validation',
      'no_object',
      'no_output',
      'schema_validation',
      'syntax',
      'network',
      'abort',
      'timeout',
      'error',
      'unknown',
    ])
    .optional(),
  inputTokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  outputTokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  reasoningTokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
});
export type ProviderFailure = z.infer<typeof providerFailureSchema>;
export const failureSchema = z.strictObject({
  branch: branchSchema,
  providerId: z.string().max(100),
  code: z.string().regex(/^[a-z_]{1,80}$/),
  retryable: z.boolean(),
  page: pageFailureSchema.optional(),
  provider: providerFailureSchema.optional(),
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
  verifierDiagnostics: z.array(verifierLedgerSchema).max(300).optional(),
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
export const discoverySelectionCandidateSchema = z
  .strictObject({
    providerIndex: z.number().int().min(0).max(9),
    url: z
      .string()
      .max(512)
      .refine(value => selectionDiagnosticUrl(value) === value)
      .nullable(),
    priority: z.number().int().min(-100).max(100).nullable(),
    rank: z.number().int().min(1).max(100).nullable(),
    selectionRank: z.number().int().min(1).max(100).nullable(),
    citationPreferred: z.boolean(),
    selected: z.boolean(),
    reason: z.enum([
      'unapproved_source',
      'duplicate',
      'unsupported_format',
      'already_consulted',
      'retrieved',
      'unavailable',
      'not_selected',
      'budget_exhausted',
    ]),
  })
  .refine(
    value =>
      (value.url === null
        ? value.priority === null && value.rank === null
        : value.priority !== null && value.rank !== null) &&
      value.selected === ['retrieved', 'unavailable'].includes(value.reason) &&
      (value.selectionRank !== null || !value.selected),
    'Discovery selection metadata must match its URL and outcome',
  );
export type DiscoverySelectionCandidate = z.infer<typeof discoverySelectionCandidateSchema>;
export const discoverySelectionSchema = z.strictObject({
  candidates: z.array(discoverySelectionCandidateSchema).max(32),
  omittedCount: z.number().int().min(0).max(1000),
});
export const roundDiagnosticSchema = z.strictObject({
  index: z.number().int().min(0).max(9),
  target: researchTargetSchema,
  reason: z.enum(['completed', 'already_supported', 'budget_exhausted']),
  gap: gapSchema,
  discoverySelection: discoverySelectionSchema.optional(),
  urls: z
    .array(
      z.strictObject({
        url: z.url().max(2048),
        outcome: z.enum(['retrieved', 'unavailable', 'already_consulted', 'unsupported_format']),
      }),
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
  .strictObject({
    // Older saved rounds contain an unused extraction name. Keep them resumable.
    result: z.preprocess(
      value =>
        value !== null && typeof value === 'object' && !Array.isArray(value)
          ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'companyName'))
          : value,
      branchResultSchema,
    ),
    diagnostic: roundDiagnosticSchema,
  })
  .refine(
    ({ result, diagnostic }) =>
      result.branch === (diagnostic.target === 'buyingIntent' ? 'signals' : 'firmographics') &&
      diagnostic.acceptedCandidates === result.candidates.length &&
      diagnostic.rejectedCandidates === result.rejections.length &&
      diagnostic.selectedCandidates <= diagnostic.extractedCandidates &&
      diagnostic.acceptedCandidates + diagnostic.rejectedCandidates <= diagnostic.selectedCandidates &&
      diagnostic.retrievedPages <= diagnostic.pageRequests &&
      (!diagnostic.discoverySelection ||
        diagnostic.discoverySelection.candidates.length + diagnostic.discoverySelection.omittedCount ===
          diagnostic.discoveredUrls),
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
  verifierDiagnostics: z.array(verifierLedgerSchema).max(3000).optional(),
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
    readonly provider?: ProviderFailure,
  ) {
    super(code, provider?.errorClass ? { cause: new Error(provider.errorClass) } : undefined);
  }
}
