import type { ZodError } from 'zod';

import { SERVER_ERROR_CODES, isServerErrorCode } from '../error-codes';
import type { ServerErrorCode, ServerProblem } from '../error-codes';
import { HTTPException } from '../http-exception';
import type { StatusCode } from '../http-exception';
import type { ApiError } from '../types';

/**
 * Duck-typed interface for ZodError-like objects.
 * Note: Zod v4 uses PropertyKey[] (string | number | symbol) for path.
 */
export interface ZodErrorLike {
  issues: Array<{
    path: PropertyKey[];
    message: string;
  }>;
}

/**
 * Recognition for `ModelNotAllowedError` from `@mastra/core/agent-builder/ee`.
 *
 * Inlined as a duck check rather than imported so that `handleError` (wired
 * into every route) does not force a load-time dependency on the
 * `@mastra/core/agent-builder/ee` subpath. That subpath only ships in
 * `@mastra/core >= 1.34.0`; deploys whose bundled `@mastra/server` resolves
 * against an older core would otherwise crash at startup with
 * `ERR_MODULE_NOT_FOUND` on `@mastra/core/dist/agent-builder/ee/index.js`.
 */
const MODEL_NOT_ALLOWED_CODE = 'MODEL_NOT_ALLOWED';

interface ModelNotAllowedErrorLike extends Error {
  code: typeof MODEL_NOT_ALLOWED_CODE;
  allowed?: unknown;
  attempted?: unknown;
  offendingLabel?: string;
}

function isModelNotAllowedError(error: unknown): error is ModelNotAllowedErrorLike {
  return error instanceof Error && (error as { code?: unknown }).code === MODEL_NOT_ALLOWED_CODE;
}

const WORKFLOW_SCHEMA_VALIDATION_FAILED_CODE = 'WORKFLOW_SCHEMA_VALIDATION_FAILED';

function isWorkflowSchemaValidationError(error: unknown): error is Error {
  return error instanceof Error && (error as { id?: unknown }).id === WORKFLOW_SCHEMA_VALIDATION_FAILED_CODE;
}

// A resume or time travel the run can't accept: another caller claimed it, it is still running,
// or it isn't waiting to be resumed.
const RUN_CLAIM_CONFLICT_CODES = new Set([
  'WORKFLOW_RESUME_ALREADY_CLAIMED',
  'AGENT_RESUME_ALREADY_CLAIMED',
  'WORKFLOW_RUN_NOT_SUSPENDED',
  'AGENT_RESUME_RUN_NOT_SUSPENDED',
  'WORKFLOW_TIME_TRAVEL_ALREADY_CLAIMED',
  'WORKFLOW_TIME_TRAVEL_RUN_RUNNING',
]);

function isRunClaimConflictError(error: unknown): error is Error & { id: string } {
  return error instanceof Error && RUN_CLAIM_CONFLICT_CODES.has((error as { id?: unknown }).id as string);
}

/**
 * Durable agent errors for a request that conflicts with the run's state:
 * another execution owns the run, it is already being recovered, it lost a
 * concurrent claim, or it is suspended (recover). Matched by id, like the
 * other checks here, so the server doesn't depend on core exporting them.
 */
const DURABLE_RUN_CONFLICT_CODES = new Set([
  'DURABLE_AGENT_RUN_ACTIVE',
  'DURABLE_AGENT_RECOVER_RUN_ACTIVE_LOCALLY',
  'DURABLE_AGENT_RECOVER_ALREADY_IN_PROGRESS',
  'DURABLE_AGENT_RECOVER_RUN_SUSPENDED',
  'DURABLE_AGENT_EXECUTION_CONFLICT',
]);

function isDurableRunConflictError(error: unknown): error is Error {
  const id = (error as { id?: unknown } | undefined)?.id;
  return error instanceof Error && typeof id === 'string' && DURABLE_RUN_CONFLICT_CODES.has(id);
}

const FEEDBACK_REVIEW_STATUS_CONFLICT_CODE = 'OBSERVABILITY_UPDATE_FEEDBACK_REVIEW_STATUS_CONFLICT';

function isFeedbackReviewStatusConflictError(error: unknown): error is Error {
  return error instanceof Error && (error as { id?: unknown }).id === FEEDBACK_REVIEW_STATUS_CONFLICT_CODE;
}

/**
 * Matches the `OBSERVABILITY_STORAGE_*_NOT_IMPLEMENTED` MastraError the base
 * observability store throws for every optional method a store doesn't
 * implement. Checked by id (not `instanceof`) so it holds across duplicated
 * `@mastra/core` installs.
 */
function isObservabilityStorageNotImplementedError(error: unknown): error is Error {
  const id = error && typeof error === 'object' && 'id' in error ? error.id : undefined;
  return typeof id === 'string' && id.startsWith('OBSERVABILITY_STORAGE_') && id.endsWith('_NOT_IMPLEMENTED');
}

/**
 * Structural check for ZodError instances.
 *
 * Avoids `instanceof ZodError` because consumers can resolve `'zod'` to a
 * different package instance (e.g. `zod@^3`) than the one a server adapter is
 * bundled with (`zod@^4`). In that case `instanceof` is false and validation
 * errors fall through to a generic response that drops field-path information.
 *
 * See https://github.com/mastra-ai/mastra/issues/17167.
 */
export function isZodError(error: unknown): error is ZodError<any> {
  return (
    !!error &&
    typeof error === 'object' &&
    (error as { name?: unknown }).name === 'ZodError' &&
    Array.isArray((error as { issues?: unknown }).issues)
  );
}

/**
 * Formats a ZodError into a structured validation error response.
 * Returns an object with an error message, an array of field-specific issues,
 * and a `REQUEST_VALIDATION_FAILED` problem carrying the same issues.
 */
export function formatZodError(
  error: ZodErrorLike,
  context: string,
  location?: 'query' | 'body' | 'path',
): { error: string; issues: Array<{ field: string; message: string }>; problem: ServerProblem } {
  const issues = error.issues.map(e => ({
    field: e.path.length > 0 ? e.path.map(p => String(p)).join('.') : 'root',
    message: e.message,
  }));

  return {
    error: `Invalid ${context}`,
    issues,
    problem: {
      code: SERVER_ERROR_CODES.REQUEST_VALIDATION_FAILED,
      metadata: location ? { issues, location } : { issues },
    },
  };
}

/**
 * Fallback used by `handleError` when the thrown error doesn't carry a more
 * specific business code. `code` is the operation code of the endpoint
 * (e.g. `AGENT_GET_FAILED`).
 */
export type HandleErrorFallback = {
  message: string;
  code: ServerErrorCode;
  metadata?: Record<string, unknown>;
};

function getErrorId(error: unknown): string | undefined {
  const id = error && typeof error === 'object' && 'id' in error ? error.id : undefined;
  return typeof id === 'string' ? id : undefined;
}

/** Only plain-object MastraError `details` are forwarded; core fills them with ids such as `runId`. */
function getErrorDetails(error: unknown): Record<string, unknown> | undefined {
  const details = error && typeof error === 'object' && 'details' in error ? error.details : undefined;
  if (!details || typeof details !== 'object' || Array.isArray(details)) return undefined;
  return details as Record<string, unknown>;
}

function mergeMetadata(...parts: Array<Record<string, unknown> | undefined>): Record<string, unknown> | undefined {
  const merged = Object.assign({}, ...parts.filter(Boolean));
  return Object.keys(merged).length > 0 ? merged : undefined;
}

// Helper to handle errors consistently
/**
 * Rethrows `error` as an `HTTPException` carrying a business `problem`.
 * A string fallback is only the message: the code then depends on the error,
 * `UNCATEGORIZED_ERROR` when it carries an HTTP status and `UNEXPECTED_ERROR` otherwise.
 */
export function handleError(error: unknown, fallbackOrMessage: HandleErrorFallback | string): never {
  const fallback: Omit<HandleErrorFallback, 'code'> & { code?: ServerErrorCode } =
    typeof fallbackOrMessage === 'string' ? { message: fallbackOrMessage } : fallbackOrMessage;
  const resolveCode = (hasStatus: boolean): ServerErrorCode => {
    const errorId = getErrorId(error);
    if (isServerErrorCode(errorId)) return errorId;
    if (fallback.code) return fallback.code;
    return hasStatus ? SERVER_ERROR_CODES.UNCATEGORIZED_ERROR : SERVER_ERROR_CODES.UNEXPECTED_ERROR;
  };

  // Already carries its own problem; rethrow as-is so nested handlers don't overwrite it.
  if (error instanceof HTTPException) {
    throw error;
  }

  if (isModelNotAllowedError(error)) {
    const modelPolicy = {
      allowed: error.allowed,
      attempted: error.attempted,
      offendingLabel: error.offendingLabel,
    };
    const metadata = mergeMetadata(fallback.metadata, modelPolicy);
    const problem: ServerProblem = metadata
      ? { code: SERVER_ERROR_CODES.MODEL_NOT_ALLOWED, metadata }
      : { code: SERVER_ERROR_CODES.MODEL_NOT_ALLOWED };
    const body = {
      error: {
        code: error.code,
        message: error.message,
        ...modelPolicy,
      },
      problem,
    };
    const res = new Response(JSON.stringify(body), {
      status: 422,
      headers: { 'content-type': 'application/json' },
    });
    throw new HTTPException(422, {
      res,
      message: error.message,
      cause: error,
      code: SERVER_ERROR_CODES.MODEL_NOT_ALLOWED,
      metadata,
    });
  }

  const errorId = getErrorId(error);

  // A losing concurrent resume or time travel, or a recover of a run that is live or suspended, is
  // a conflict on run state, not a malformed request, so it maps to 409 and clients can
  // distinguish it from a 400/500 and re-read the run.
  if (isRunClaimConflictError(error) || isDurableRunConflictError(error)) {
    const code = resolveCode(true);
    const metadata = mergeMetadata(fallback.metadata, getErrorDetails(error));
    const problem: ServerProblem = metadata ? { code, metadata } : { code };
    const res = isRunClaimConflictError(error)
      ? new Response(JSON.stringify({ error: error.message, code: error.id, problem }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        })
      : undefined;
    throw new HTTPException(409, {
      res,
      message: error.message,
      stack: error.stack,
      cause: error,
      code,
      metadata,
    });
  }

  // The feedback row changed under a review-status update, so the caller re-reads and retries;
  // that is a conflict, not a broken store.
  if (isFeedbackReviewStatusConflictError(error)) {
    throw new HTTPException(409, {
      message: error.message,
      stack: error.stack,
      cause: error,
      code: SERVER_ERROR_CODES.OBSERVABILITY_UPDATE_FEEDBACK_REVIEW_STATUS_CONFLICT,
      metadata: mergeMetadata(fallback.metadata, getErrorDetails(error)),
    });
  }

  if (isWorkflowSchemaValidationError(error)) {
    throw new HTTPException(400, {
      message: error.message,
      stack: error.stack,
      cause: error,
      code: SERVER_ERROR_CODES.WORKFLOW_SCHEMA_VALIDATION_FAILED,
      metadata: mergeMetadata(fallback.metadata, getErrorDetails(error)),
    });
  }

  // Optional observability APIs (feedback, metrics, logs, scores, ...) throw
  // `*_NOT_IMPLEMENTED` on stores that don't support them. That's a missing
  // capability, not a server fault, so it maps to 501 — which server adapters
  // log as a warning instead of an error. The message is preserved because
  // clients match on it to detect unsupported operations. Clients should check
  // `GET /observability/capabilities` before calling optional routes.
  if (isObservabilityStorageNotImplementedError(error)) {
    throw new HTTPException(501, {
      message: error.message,
      stack: error.stack,
      cause: error,
      code: SERVER_ERROR_CODES.OBSERVABILITY_OPERATION_NOT_SUPPORTED,
      metadata: fallback.metadata,
    });
  }

  const apiError = error as ApiError;

  const explicitStatus = apiError.status || apiError.details?.status;

  throw new HTTPException((explicitStatus || 500) as StatusCode, {
    message: apiError.message || fallback.message,
    stack: apiError.stack,
    cause: apiError.cause,
    // An error whose id is already a catalog code keeps it; anything else gets the operation code.
    code: resolveCode(Boolean(explicitStatus)),
    metadata: fallback.metadata,
  });
}
