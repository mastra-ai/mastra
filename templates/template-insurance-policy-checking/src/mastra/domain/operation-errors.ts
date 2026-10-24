import { z } from 'zod';

export const failureSchema = z.object({
  ok: z.literal(false).describe('False for a safe operation failure.'),
  code: z.string().min(1).describe('Stable machine-readable failure or validation code.'),
  message: z.string().min(1).describe('Safe user-facing explanation without private provider errors.'),
  nextAction: z.string().min(1).optional().describe('Suggested recovery step for the caller.'),
  status: z
    .number()
    .int()
    .min(400)
    .max(599)
    .optional()
    .describe('Analytical or provider status represented by this contract.'),
});
export type Failure = z.infer<typeof failureSchema>;
export class IntakeError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly nextAction?: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
export const groundingDiagnosticSchema = z
  .object({
    reason: z
      .enum([
        'source_id_mismatch',
        'source_version_mismatch',
        'source_hash_mismatch',
        'physical_page_missing',
        'record_locator_missing',
        'excerpt_not_exact',
        'original_not_in_excerpt',
        'typed_value_unsupported',
        'review_locator_kind_mismatch',
        'reviewed_locator_missing',
      ])
      .describe('Allowlisted grounding failure reason, independent of private source content.'),
    path: z
      .array(
        z.union([
          z.number().int().min(0).max(1000),
          z.enum([
            'sourceId',
            'version',
            'hash',
            'physicalPage',
            'recordId',
            'field',
            'excerpt',
            'terms',
            'changes',
            'evidence',
            'original',
            'value',
            'reviewedPages',
            'reviewedRecords',
            'assessments',
            'amount',
            'currency',
            'unit',
            'basis',
            'minimum',
            'maximum',
            'name',
            'address',
            'wording',
            'heading',
            'clauseId',
          ]),
        ]),
      )
      .max(8)
      .describe('Allowlisted field path identifying the invalid value without exposing private input.'),
  })
  .strict();
export type GroundingPath = z.infer<typeof groundingDiagnosticSchema>['path'];
export class EvidenceValidationError extends IntakeError {
  readonly grounding: z.infer<typeof groundingDiagnosticSchema>;
  readonly sourceId?: string;
  constructor(grounding: z.input<typeof groundingDiagnosticSchema>, trustedSourceId?: string) {
    const diagnostic = groundingDiagnosticSchema.parse(grounding);
    const sourceId = trustedSourceId === undefined ? undefined : z.uuid().parse(trustedSourceId);
    super(
      'INVALID_COMPARISON_EVIDENCE',
      'The model returned evidence or a normalized value that cannot be verified in the captured source.',
      `Inspect captured source ${sourceId ?? 'for this request'}: ${diagnostic.reason} at ${diagnostic.path.join('.') || 'evidence'}. Correct the extraction before an explicit retry; exact grounding remains required.`,
    );
    this.grounding = diagnostic;
    this.sourceId = sourceId;
  }
}
export function safeFailure(error: unknown): Failure {
  if (error instanceof IntakeError)
    return failureSchema.parse({
      ok: false,
      code: error.code,
      message: error.message,
      nextAction: error.nextAction,
      status: error.status,
    });
  if (error instanceof z.ZodError) {
    if (error.issues.some(issue => issue.code === 'custom' && issue.params?.inputConflict === 'roles'))
      return {
        ok: false,
        code: 'ROLE_CONFLICT',
        status: 400,
        message: 'Identical sources have conflicting document roles.',
        nextAction: 'Clarify the intended source roles before submitting another intake.',
      };
    const issue = error.issues.find(
      issue => issue.code === 'custom' && ['pdfBytes', 'documents'].includes(String(issue.params?.inputLimit)),
    );
    if (
      issue?.code === 'custom' &&
      typeof issue.params?.effectiveLimit === 'number' &&
      Number.isSafeInteger(issue.params.effectiveLimit) &&
      issue.params.effectiveLimit > 0
    ) {
      const bytes = issue.params.inputLimit === 'pdfBytes';
      return {
        ok: false,
        code: bytes ? 'BYTE_LIMIT' : 'DOCUMENT_LIMIT',
        status: 400,
        message: bytes
          ? `Each PDF must contain at most ${issue.params.effectiveLimit} bytes.`
          : `At most ${issue.params.effectiveLimit} documents are allowed per case.`,
        nextAction: 'Reduce the input or change src/mastra/config/input-limits-config.ts and restart.',
      };
    }
  }
  if (error instanceof z.ZodError)
    return {
      ok: false,
      code: 'INVALID_INPUT',
      status: 400,
      message: 'The request or provider result does not match the supported input contract.',
      nextAction:
        'Use direct textual PDF attachments within src/mastra/config/input-limits-config.ts, or correct the registered provider and case clarification fields.',
    };
  return {
    ok: false,
    code: 'SERVICE_UNAVAILABLE',
    status: 503,
    message: 'The operation could not be completed. Its saved state has not been confirmed.',
    nextAction:
      'Check case status before retrying. Check the local database and private artifact directory if the problem continues.',
  };
}
export async function safely<T>(operation: () => Promise<T>): Promise<T | Failure> {
  try {
    return await operation();
  } catch (error) {
    return safeFailure(error);
  }
}
export function failureText(error: unknown): string {
  const failure = safeFailure(error);
  return `${failure.message}${failure.nextAction ? ` ${failure.nextAction}` : ''} (${failure.code})`;
}

export function isDatabaseBusy(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    ['SQLITE_BUSY', 'SQLITE_LOCKED'].includes(String(error.code)),
  );
}
