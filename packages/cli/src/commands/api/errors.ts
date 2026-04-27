export type ApiErrorCode =
  | 'INVALID_JSON'
  | 'MISSING_INPUT'
  | 'MISSING_ARGUMENT'
  | 'MALFORMED_HEADER'
  | 'SERVER_UNREACHABLE'
  | 'REQUEST_TIMEOUT'
  | 'HTTP_ERROR'
  | 'SCHEMA_UNAVAILABLE'
  | 'PLATFORM_RESOLUTION_FAILED';

export class ApiCliError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function errorEnvelope(error: ApiCliError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  };
}

export function toApiCliError(error: unknown): ApiCliError {
  if (error instanceof ApiCliError) return error;
  if (error instanceof Error && error.name === 'AbortError') {
    return new ApiCliError('REQUEST_TIMEOUT', 'Request timed out');
  }
  return new ApiCliError('SERVER_UNREACHABLE', 'Could not connect to target server', {
    message: error instanceof Error ? error.message : String(error),
  });
}
