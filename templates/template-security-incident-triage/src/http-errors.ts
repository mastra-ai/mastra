import type { Context } from 'hono';

import type { AppEnv } from './http-context.js';
import type { StructuredLogger } from './logging.js';

export type HttpErrorCode =
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'SIGNATURE_MISSING'
  | 'SIGNATURE_MALFORMED'
  | 'SIGNATURE_INVALID'
  | 'SIGNATURE_EXPIRED'
  | 'AUTHENTICATION_REQUIRED'
  | 'ACCESS_DENIED'
  | 'PAYLOAD_INVALID'
  | 'ALERT_CONFLICT'
  | 'STORAGE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export function errorResponse(
  context: Context<AppEnv>,
  code: HttpErrorCode,
  status: 401 | 403 | 409 | 413 | 415 | 422 | 429 | 500 | 503,
  retryable: boolean,
  logger: StructuredLogger,
) {
  logger.write({
    event: 'http.request.rejected',
    requestId: context.get('requestId'),
    correlationId: context.get('correlationId'),
    errorCode: code,
    status,
  });
  return context.json(
    {
      code,
      message: publicMessage(code),
      requestId: context.get('requestId'),
      retryable,
    },
    status,
  );
}

function publicMessage(code: HttpErrorCode): string {
  switch (code) {
    case 'UNSUPPORTED_MEDIA_TYPE':
      return 'Content-Type must be application/json.';
    case 'PAYLOAD_TOO_LARGE':
      return 'The request body is too large.';
    case 'RATE_LIMITED':
      return 'Too many requests. Please retry later.';
    case 'PAYLOAD_INVALID':
      return 'The request payload is invalid.';
    case 'ALERT_CONFLICT':
      return 'The alert conflicts with an existing event.';
    case 'STORAGE_UNAVAILABLE':
      return 'Storage is temporarily unavailable.';
    case 'INTERNAL_ERROR':
      return 'An internal error occurred.';
    case 'AUTHENTICATION_REQUIRED':
      return 'Authentication is required.';
    case 'ACCESS_DENIED':
      return 'Access is denied.';
    default:
      return 'Webhook signature validation failed.';
  }
}
