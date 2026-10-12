import { MASTRA_ERROR_CODES, buildProblem, isMastraErrorCode } from '../http-errors';
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

// Accepts HTTPException-like errors from packages that cannot depend on
// @mastra/server (e.g. @internal/voice), as long as the code is in the catalogue.
function resolveCode(error: unknown): MastraErrorCode | undefined {
  if (error instanceof HTTPException) return error.code;
  const code = (error as { code?: unknown } | null)?.code;
  return isMastraErrorCode(code) ? code : undefined;
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
  const code = resolveCode(error);

  return {
    status,
    body: {
      error: message,
      problem: buildProblem({ status, code, detail: message }),
    },
  };
}

const VALIDATION_CODES = {
  body: MASTRA_ERROR_CODES.INVALID_REQUEST_BODY,
  query: MASTRA_ERROR_CODES.INVALID_QUERY_PARAMS,
  path: MASTRA_ERROR_CODES.INVALID_PATH_PARAMS,
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

/**
 * Adds a coded `problem` to an error body built outside of an exception (auth,
 * RBAC/FGA, body limit, rate limit...). Legacy fields are kept untouched and an
 * existing `problem` wins. Non-object bodies (e.g. from a user `onError` hook) are
 * wrapped under `error`.
 */
export function withProblem<T extends object>(
  body: T,
  status: number,
  code: MastraErrorCode,
): T & { problem: ProblemDetails };
export function withProblem(
  body: unknown,
  status: number,
  code: MastraErrorCode,
): Record<string, unknown> & { problem: ProblemDetails };
export function withProblem(body: unknown, status: number, code: MastraErrorCode) {
  const base: Record<string, unknown> =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : { error: String(body) };
  if (base.problem) return base;
  const detail = typeof base.error === 'string' ? base.error : undefined;
  return { ...base, problem: buildProblem({ status, code, detail }) };
}
