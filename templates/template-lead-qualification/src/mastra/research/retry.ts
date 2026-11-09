import { providerValidationIssueSchema, ResearchError } from './contracts';
import type { ProviderFailure } from './contracts';
import type { ResearchContext } from '../providers/evidence';

const errorClasses: Record<string, ProviderFailure['errorClass']> = {
  AI_APICallError: 'api_call',
  AI_RetryError: 'retry',
  AI_JSONParseError: 'json_parse',
  AI_TypeValidationError: 'type_validation',
  AI_NoObjectGeneratedError: 'no_object',
  AI_NoOutputGeneratedError: 'no_output',
  ZodError: 'schema_validation',
  SyntaxError: 'syntax',
  TypeError: 'network',
  AbortError: 'abort',
  TimeoutError: 'timeout',
  Error: 'error',
};
export function normalizedResearchError(error: unknown, provider?: ProviderFailure): ResearchError {
  if (error instanceof ResearchError) return error;
  let details = error as {
    name?: string;
    id?: string;
    statusCode?: number;
    responseHeaders?: Record<string, string>;
    cause?: unknown;
    issues?: unknown[];
  } | null;
  let status: number | undefined;
  let retryAfter: string | undefined;
  let errorClass: ProviderFailure['errorClass'];
  const validationIssues: NonNullable<ProviderFailure['validationIssues']> = [];
  for (let depth = 0; details && typeof details === 'object' && depth < 5; depth++) {
    if (Number.isInteger(details.statusCode) && details.statusCode! >= 100 && details.statusCode! <= 599)
      status = details.statusCode;
    if (typeof details.responseHeaders?.['retry-after'] === 'string')
      retryAfter = details.responseHeaders['retry-after'];
    if (Array.isArray(details.issues)) {
      for (const value of details.issues.slice(0, 8 - validationIssues.length)) {
        const issue = value as { code?: unknown; path?: unknown[] } | null;
        if (!issue || typeof issue !== 'object') continue;
        const path = Array.isArray(issue.path)
          ? issue.path.slice(0, 8).map(part => {
              const parsed = providerValidationIssueSchema.shape.path.element.safeParse(part);
              return parsed.success ? parsed.data : 'unknown_field';
            })
          : [];
        const parsed = providerValidationIssueSchema.safeParse({ code: issue.code, path });
        if (parsed.success) validationIssues.push(parsed.data);
      }
    }
    const known =
      details.id === 'STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED'
        ? 'schema_validation'
        : details.id === 'STRUCTURED_OUTPUT_OBJECT_UNDEFINED' || details.id === 'STRUCTURED_OUTPUT_TRUNCATED'
          ? 'no_object'
          : typeof details.name === 'string' && Object.hasOwn(errorClasses, details.name)
            ? errorClasses[details.name]
            : undefined;
    if (known && (known !== 'error' || !errorClass)) errorClass = known;
    if (!details.cause) break;
    details = details.cause as typeof details;
  }
  const delay = retryAfter
    ? /^\d+$/.test(retryAfter)
      ? Number(retryAfter) * 1000
      : Math.max(0, Date.parse(retryAfter) - Date.now())
    : 0;
  return new ResearchError(
    status === 401 || status === 403
      ? 'provider_auth_failed'
      : status === 429
        ? 'provider_rate_limited'
        : 'provider_failed',
    status === 429 || (status !== undefined && status >= 500) || errorClass === 'network',
    Number.isFinite(delay) ? delay : 0,
    undefined,
    provider
      ? {
          ...provider,
          ...(status ? { httpStatus: status } : {}),
          errorClass: errorClass ?? 'unknown',
          ...(validationIssues.length ? { validationIssues } : {}),
        }
      : undefined,
  );
}
export async function retryWithinBudget<T>(
  operation: () => Promise<T>,
  context: Omit<ResearchContext, 'round'>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const failure = normalizedResearchError(error);
      const wait = Math.max(100 * 2 ** attempt, failure.retryAfterMs);
      if (
        !failure.retryable ||
        attempt >= context.snapshot.config.research.maxRetries ||
        Date.now() + wait >= context.deadline
      )
        throw failure;
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }
}
