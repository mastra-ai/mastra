import { inputLimitsSchema, type InputLimits } from '../config/input-limits-config.js';
import { contextSchema, validateBundle, type InputProvider, type OperationContext } from '../domain/case-contracts.js';
import { IntakeError } from '../domain/operation-errors.js';
import type { CaseRepository } from '../storage/case-repository.js';

/** Coordinate validated capture, clarification, and evidence access against the authoritative case store. */
export function createCaseService(
  repository: CaseRepository,
  inputProvider: InputProvider,
  configuredLimits: InputLimits,
  comparisonStatus?: (context: OperationContext) => Promise<unknown>,
  reportStatus?: (context: OperationContext) => Promise<unknown>,
) {
  const limits = inputLimitsSchema.parse(configuredLimits);
  return {
    repository,
    async capture(context: OperationContext, input: unknown, newCase = false) {
      contextSchema.parse(context);
      const request = inputProvider.requestSchema.parse(input);
      const attemptId = await repository.beginAttempt(context, inputProvider.id, limits);
      try {
        const captured = await inputProvider.capture(request, context, limits);
        const bundle = validateBundle(captured, limits, inputProvider.id);
        const record = await repository.saveBundle(context, bundle, limits, inputProvider.id, newCase);
        await repository.endAttempt(attemptId, 'COMPLETED');
        return record;
      } catch (error) {
        await repository.endAttempt(attemptId, 'FAILED');
        throw error;
      }
    },
    async status(context: OperationContext) {
      contextSchema.parse(context);
      const record = await repository.active(context);
      if (!record)
        return {
          case: null,
          sources: undefined,
          message: 'No case is selected. Attach textual PDFs to create a case.',
        };
      const sources = await repository.sources(context);
      const clarifications = [];
      if (sources.length < 2) clarifications.push('Attach at least two documents for a future comparison.');
      if (!record.clarification)
        clarifications.push(
          'Identify the comparison intent, reference, target, document roles and any policy identity. A selected reference does not establish contractual acceptance.',
        );
      const metadata = sources.map(source =>
        source.kind === 'pdf'
          ? {
              ...source,
              pages: source.pages.map(({ text, ...page }) => ({ ...page, hasSearchableText: Boolean(text.trim()) })),
            }
          : {
              ...source,
              records: undefined,
              evidence: source.evidence.map(({ value: _value, ...locator }) => locator),
            },
      );
      return {
        case: record,
        sources: metadata,
        clarifications,
        recovery: await repository.recovery(),
        ...(comparisonStatus ? { reconciliation: await comparisonStatus(context) } : {}),
        ...(reportStatus ? { report: await reportStatus(context) } : {}),
        message:
          'Documents are captured. Evidence-backed comparison requires explicit clarification and uses the configured processing limits. Draft reports become available after successful publication. Broker review must identify the exact version. Read /report for pending review, saved decisions and available final downloads.',
      };
    },
    async clarify(context: OperationContext, input: unknown) {
      contextSchema.parse(context);
      return repository.clarify(context, input);
    },
    async evidence(
      context: OperationContext,
      sourceId: string,
      locator: { physicalPage?: number; recordId?: string; field?: string },
    ) {
      contextSchema.parse(context);
      return repository.evidence(context, sourceId, locator);
    },
    requireThread(threadId?: string): string {
      if (!threadId)
        throw new IntakeError(
          'THREAD_REQUIRED',
          'The current conversation has no persistent thread identifier.',
          'Open a new Studio conversation and submit the documents again.',
        );
      return threadId;
    },
  };
}
export type CaseService = ReturnType<typeof createCaseService>;
