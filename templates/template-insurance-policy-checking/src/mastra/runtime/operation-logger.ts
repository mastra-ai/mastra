import { ConsoleLogger } from '@mastra/core/logger';
import { z } from 'zod';
import { groundingDiagnosticSchema } from '../domain/operation-errors.js';

export const privateFrameworkLogger = new ConsoleLogger({ name: 'insurance-framework', filter: () => false });
const logger = new ConsoleLogger({ name: 'insurance-policy', level: 'info' });
export const processingFailurePhaseSchema = z.enum([
  'native_generation',
  'native_result_error',
  'tripwire',
  'finish_reason',
  'schema_validation',
  'deadline',
  'transport_interruption',
  'transport_request',
  'evidence_validation',
]);
export const finishReasonSchema = z.enum([
  'stop',
  'length',
  'content-filter',
  'tool-calls',
  'error',
  'other',
  'unknown',
]);
export const nativeErrorKindSchema = z.enum([
  'ZodError',
  'AI_TypeValidationError',
  'AI_NoObjectGeneratedError',
  'AI_JSONParseError',
  'AI_NoOutputGeneratedError',
  'AI_InvalidResponseDataError',
  'AI_APICallError',
  'AI_NoContentGeneratedError',
  'AI_EmptyResponseBodyError',
  'AbortError',
  'TimeoutError',
  'MastraError',
  'Error',
  'unknown',
]);
const nativeErrorCodeSchema = z.enum([
  'STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED',
  'STRUCTURED_OUTPUT_OBJECT_UNDEFINED',
  'STRUCTURED_OUTPUT_TRUNCATED',
  'AGENT_GENERATE_FAILED',
  'AGENT_GENERATE_UNKNOWN_ERROR',
  'AGENT_GENERATE_MALFORMED_RESULT',
]);
const issueSchema = z.object({
  code: z
    .enum([
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
    ])
    .describe('Stable machine-readable failure or validation code.'),
  path: z
    .array(
      z.union([
        z.number().int().min(0).max(1000),
        z.enum([
          'sourceId',
          'terms',
          'reviewedPages',
          'reviewedRecords',
          'complete',
          'limitations',
          'changes',
          'category',
          'key',
          'label',
          'scope',
          'value',
          'original',
          'evidence',
          'uncertainty',
          'type',
          'amount',
          'currency',
          'unit',
          'basis',
          'minimum',
          'maximum',
          'granularity',
          'name',
          'address',
          'wording',
          'clauseId',
          'heading',
          'version',
          'hash',
          'physicalPage',
          'recordId',
          'field',
          'excerpt',
          'policyNumber',
          'effectiveFrom',
          'effectiveTo',
          'approver',
          'approvalStatement',
          'assessments',
          'conclusion',
          'observation',
          'interpretation',
        ]),
      ]),
    )
    .max(8)
    .describe('Allowlisted field path identifying the invalid value without exposing private input.'),
});

/** Native errors can cross serialization boundaries; inspect only finite diagnostic fields. */
export function processingDiagnostics(error: unknown) {
  const diagnostic: {
    nativeErrorKind: z.infer<typeof nativeErrorKindSchema>;
    nativeErrorShape: 'error' | 'object' | 'string' | 'other';
    nativeErrorCode?: z.infer<typeof nativeErrorCodeSchema>;
    finishReason?: z.infer<typeof finishReasonSchema>;
    issues: z.infer<typeof issueSchema>[];
  } = {
    nativeErrorKind: 'unknown',
    nativeErrorShape:
      error instanceof Error
        ? 'error'
        : error && typeof error === 'object'
          ? 'object'
          : typeof error === 'string'
            ? 'string'
            : 'other',
    issues: [],
  };
  let current = error;
  for (let depth = 0; depth < 3 && current && typeof current === 'object'; depth++) {
    const candidate = current as Record<string, unknown>;
    const kind = nativeErrorKindSchema.safeParse(candidate.name);
    if (
      kind.success &&
      kind.data !== 'unknown' &&
      (diagnostic.nativeErrorKind === 'unknown' || diagnostic.nativeErrorKind === 'Error')
    )
      diagnostic.nativeErrorKind = kind.data;
    const code = nativeErrorCodeSchema.safeParse(candidate.id ?? candidate.code);
    if (code.success) {
      diagnostic.nativeErrorCode = code.data;
      if (diagnostic.nativeErrorKind === 'unknown' || diagnostic.nativeErrorKind === 'Error')
        diagnostic.nativeErrorKind = 'MastraError';
    }
    const finish = finishReasonSchema.safeParse(candidate.finishReason);
    if (finish.success) diagnostic.finishReason = finish.data;
    if (Array.isArray(candidate.issues))
      for (const issue of candidate.issues.slice(0, 8 - diagnostic.issues.length)) {
        const parsed = issueSchema.safeParse(issue);
        if (parsed.success) diagnostic.issues.push(parsed.data);
      }
    current = candidate.cause;
  }
  return diagnostic;
}
const metadataSchema = z
  .object({
    stage: z
      .enum(['processing', 'draft', 'review', 'finalization', 'startup', 'provider'])
      .describe('Operational stage recorded without document text or identity.'),
    outcome: z
      .enum(['started', 'completed', 'failed', 'recovered', 'revised', 'approved', 'rejected', 'recorded'])
      .describe('Allowlisted outcome of this operational stage.'),
    caseId: z.uuid().optional().describe('Identifier of the case selected in this conversation.'),
    runId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,200}$/)
      .optional()
      .describe('Workflow or evaluation run identifier used for correlation.'),
    attemptId: z.uuid().optional().describe('Identifier of the processing attempt that produced this result.'),
    sourceId: z.uuid().optional().describe('Immutable captured source identifier; copy it exactly from the source.'),
    reservationId: z.uuid().optional().describe('Identifier of the conservative request budget reservation.'),
    reportId: z.uuid().optional().describe('Identifier of the exact immutable report version.'),
    durationMs: z.number().nonnegative().optional().describe('Elapsed operation time in milliseconds.'),
    turnaroundMs: z
      .number()
      .nonnegative()
      .optional()
      .describe('Elapsed milliseconds from report creation to broker review.'),
    checked: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Findings checked against at least two complete source scopes with sufficient term evidence.'),
    classifications: z
      .object({
        match: z.number().int().nonnegative().describe('Count of matching terms.'),
        discrepancy: z.number().int().nonnegative().describe('Count of observed discrepancies.'),
        authorized: z
          .number()
          .int()
          .nonnegative()
          .describe('Number of findings explained by verified authorized changes.'),
        unresolved: z
          .number()
          .int()
          .nonnegative()
          .describe('Number of findings with missing evidence or unresolved review questions.'),
      })
      .strict()
      .optional()
      .describe('Counts grouped by the machine finding classification.'),
    version: z.number().int().positive().optional().describe('Immutable version of this source or report.'),
    revision: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Monotonically increasing case revision used to reject stale updates.'),
    overrides: z.number().int().nonnegative().optional().describe('Number of recorded broker severity overrides.'),
    errorCode: z
      .string()
      .regex(/^[A-Z_]{1,80}$/)
      .optional()
      .describe('Allowlisted failure code without raw provider content.'),
    processingStage: z.enum(['extraction', 'semantic']).optional().describe('Extraction or semantic-assessment stage.'),
    failurePhase: processingFailurePhaseSchema
      .optional()
      .describe('Bounded processing phase that rejected the result.'),
    finishReason: finishReasonSchema.optional().describe('Provider completion reason, restricted to supported values.'),
    nativeErrorKind: nativeErrorKindSchema.optional().describe('Allowlisted native error class after serialization.'),
    nativeErrorShape: z
      .enum(['error', 'object', 'string', 'other'])
      .optional()
      .describe('Original error representation before diagnostic filtering.'),
    nativeErrorCode: nativeErrorCodeSchema.optional().describe('Allowlisted framework error identifier.'),
    issues: z.array(issueSchema).max(8).optional().describe('Bounded validation codes and paths without source text.'),
    grounding: groundingDiagnosticSchema
      .optional()
      .describe('Safe diagnostic identifying unverifiable source evidence.'),
    recovery: z
      .enum(['read_status', 'read_report', 'retry_publication'])
      .optional()
      .describe('Suggested operation for recovering the persisted state.'),
    estimatedCostMicros: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .optional()
      .describe('Configured token-price estimate; null when usage is unavailable.'),
    inputTokens: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .optional()
      .describe('Input-token usage or conservative reservation, as indicated by its enclosing contract.'),
    outputTokens: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .optional()
      .describe('Reported output-token usage; null when unavailable.'),
    costMicros: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe('Actual billing cost in millionths of currency; null when unavailable.'),
  })
  .strict();

/** General operations never accept source text, identity, review prose or provider errors. */
export function operation(metadata: z.input<typeof metadataSchema>) {
  logger.info('insurance.operation', metadataSchema.parse(metadata));
}
