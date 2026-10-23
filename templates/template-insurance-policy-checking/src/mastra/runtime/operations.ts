import { ConsoleLogger } from '@mastra/core/logger';
import { z } from 'zod';

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
    .max(8),
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
    stage: z.enum(['processing', 'draft', 'review', 'finalization', 'startup', 'provider']),
    outcome: z.enum(['started', 'completed', 'failed', 'recovered', 'revised', 'approved', 'rejected', 'recorded']),
    caseId: z.uuid().optional(),
    runId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,200}$/)
      .optional(),
    attemptId: z.uuid().optional(),
    sourceId: z.uuid().optional(),
    reservationId: z.uuid().optional(),
    reportId: z.uuid().optional(),
    durationMs: z.number().nonnegative().optional(),
    turnaroundMs: z.number().nonnegative().optional(),
    checked: z.number().int().nonnegative().optional(),
    classifications: z
      .object({
        match: z.number().int().nonnegative(),
        discrepancy: z.number().int().nonnegative(),
        authorized: z.number().int().nonnegative(),
        unresolved: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
    version: z.number().int().positive().optional(),
    revision: z.number().int().positive().optional(),
    overrides: z.number().int().nonnegative().optional(),
    errorCode: z
      .string()
      .regex(/^[A-Z_]{1,80}$/)
      .optional(),
    processingStage: z.enum(['extraction', 'semantic']).optional(),
    failurePhase: processingFailurePhaseSchema.optional(),
    finishReason: finishReasonSchema.optional(),
    nativeErrorKind: nativeErrorKindSchema.optional(),
    nativeErrorShape: z.enum(['error', 'object', 'string', 'other']).optional(),
    nativeErrorCode: nativeErrorCodeSchema.optional(),
    issues: z.array(issueSchema).max(8).optional(),
    recovery: z.enum(['read_status', 'read_report', 'retry_publication']).optional(),
    estimatedCostMicros: z.number().int().nonnegative().nullable().optional(),
    inputTokens: z.number().int().nonnegative().nullable().optional(),
    outputTokens: z.number().int().nonnegative().nullable().optional(),
    costMicros: z.number().int().nonnegative().nullable(),
  })
  .strict();

/** General operations never accept source text, identity, review prose or provider errors. */
export function operation(metadata: z.input<typeof metadataSchema>) {
  logger.info('insurance.operation', metadataSchema.parse(metadata));
}
