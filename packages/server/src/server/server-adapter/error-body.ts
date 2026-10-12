import { buildProblem } from '../http-errors';
import type { MastraErrorCode, ProblemDetails } from '../http-errors';
import { HTTPException } from '../http-exception';

export interface ErrorBody {
  error: string;
  problem: ProblemDetails;
}

export interface ValidationErrorBody {
  error: string;
  issues: Array<{ field: string; message: string }>;
  problem: ProblemDetails;
}

function resolveStatus(error: unknown): number {
  if (error && typeof error === 'object') {
    const direct = (error as { status?: unknown }).status;
    if (typeof direct === 'number') return direct;
    const fromDetails = (error as { details?: { status?: unknown } }).details?.status;
    if (typeof fromDetails === 'number') return fromDetails;
  }
  return 500;
}

/**
 * Builds the JSON error body shared by all server adapters. The legacy `error`
 * string is preserved as-is; `problem` is the additive RFC 9457 object. Only
 * public business codes carried by an HTTPException surface: internal ids never do,
 * and 5xx details are masked inside `problem`.
 */
export function toErrorBody(error: unknown): { status: number; body: ErrorBody } {
  const status = resolveStatus(error);
  const message = error instanceof Error ? error.message : 'Unknown error';
  const code: MastraErrorCode | undefined = error instanceof HTTPException ? error.code : undefined;

  return {
    status,
    body: {
      error: message,
      problem: buildProblem({ status, code, detail: message }),
    },
  };
}

const VALIDATION_CODES = {
  body: 'INVALID_REQUEST_BODY',
  query: 'INVALID_QUERY_PARAMS',
  path: 'INVALID_PATH_PARAMS',
} as const satisfies Record<'body' | 'query' | 'path', MastraErrorCode>;

/** Enriches a `{ error, issues }` validation body with a coded `problem`. */
export function toValidationErrorBody(
  body: { error: string; issues: Array<{ field: string; message: string }> },
  context: keyof typeof VALIDATION_CODES,
): ValidationErrorBody {
  return {
    ...body,
    problem: buildProblem({
      status: 400,
      code: VALIDATION_CODES[context],
      detail: body.error,
      issues: body.issues,
    }),
  };
}
