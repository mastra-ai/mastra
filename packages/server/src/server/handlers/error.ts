import type { ZodError } from 'zod';

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

const WORKFLOW_RESUME_ALREADY_CLAIMED_CODE = 'WORKFLOW_RESUME_ALREADY_CLAIMED';

function isWorkflowResumeAlreadyClaimedError(error: unknown): error is Error {
  return error instanceof Error && (error as { id?: unknown }).id === WORKFLOW_RESUME_ALREADY_CLAIMED_CODE;
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
 * Returns an object with an error message and an array of field-specific issues.
 */
export function formatZodError(
  error: ZodErrorLike,
  context: string,
): { error: string; issues: Array<{ field: string; message: string }> } {
  const issues = error.issues.map(e => ({
    field: e.path.length > 0 ? e.path.map(p => String(p)).join('.') : 'root',
    message: e.message,
  }));

  return {
    error: `Invalid ${context}`,
    issues,
  };
}

// Helper to handle errors consistently
export function handleError(error: unknown, defaultMessage: string): never {
  if (isModelNotAllowedError(error)) {
    const body = {
      error: {
        code: error.code,
        message: error.message,
        allowed: error.allowed,
        attempted: error.attempted,
        offendingLabel: error.offendingLabel,
      },
    };
    const res = new Response(JSON.stringify(body), {
      status: 422,
      headers: { 'content-type': 'application/json' },
    });
    throw new HTTPException(422, {
      res,
      message: error.message,
      cause: error,
    });
  }

  // A losing concurrent resume is a conflict on run state, not a malformed request, so it maps
  // to 409 and clients can distinguish it from a 400/500 and re-read the run.
  if (isWorkflowResumeAlreadyClaimedError(error)) {
    throw new HTTPException(409, {
      message: error.message,
      stack: error.stack,
      cause: error,
    });
  }

  if (isWorkflowSchemaValidationError(error)) {
    throw new HTTPException(400, {
      message: error.message,
      stack: error.stack,
      cause: error,
    });
  }

  const apiError = error as ApiError;

  const apiErrorStatus = apiError.status || apiError.details?.status || 500;

  throw new HTTPException(apiErrorStatus as StatusCode, {
    message: apiError.message || defaultMessage,
    stack: apiError.stack,
    cause: apiError.cause,
  });
}
