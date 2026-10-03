export type MastraConnectErrorCode =
  | 'missing_access_token'
  | 'missing_project_id'
  | 'missing_connection_id'
  | 'invalid_options'
  | 'connection_not_found'
  | 'unauthorized'
  | 'proxy_error'
  | 'unsupported_credential_type'
  | 'no_active_connection'
  | 'platform_error'
  // Raised at tool-execute time when the caller supplies a connection_name
  // that does not match any active connection for the provider. Recovery is
  // to call `<provider>__list_connections` and retry with a valid name.
  | 'unknown_connection';

const MAX_DETAIL_LENGTH = 2000;

export class MastraConnectError extends Error {
  readonly code: MastraConnectErrorCode;
  readonly status?: number;
  readonly detail?: string;
  /**
   * Axios-compatible alias for {@link status}. Generated provider tools come
   * from upstream Nango templates whose error handlers check
   * `error.response.status` (the axios/Nango SDK shape). Exposing the HTTP
   * status under `response.status` as well lets that generated code work
   * unchanged against the errors this package throws. Only set when the error
   * carries an HTTP status.
   */
  readonly response?: { status: number };

  constructor(code: MastraConnectErrorCode, message: string, options?: { status?: number; detail?: string }) {
    super(message);
    this.name = 'MastraConnectError';
    this.code = code;
    this.status = options?.status;
    this.detail = options?.detail ? truncate(options.detail) : undefined;
    if (typeof options?.status === 'number') {
      this.response = { status: options.status };
    }
  }
}

function truncate(text: string): string {
  return text.length > MAX_DETAIL_LENGTH ? `${text.slice(0, MAX_DETAIL_LENGTH)}…` : text;
}

/**
 * Pulls the first human-readable message from an array of error entries. Many
 * providers (Clerk, Linear's GraphQL envelope, Nango v2) return
 * `{ errors: [{ message, long_message, code }] }`; surfacing the first message
 * is the most useful detail without echoing the whole payload.
 */
function extractFirstArrayMessage(errors: unknown[]): string | undefined {
  for (const entry of errors) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as { message?: unknown; long_message?: unknown };
    const message = typeof record.long_message === 'string' ? record.long_message : record.message;
    if (typeof message === 'string' && message) return message;
  }
  return undefined;
}

interface ProblemJson {
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  error?: string | { message?: unknown };
  // Many providers (Clerk, Nango v2, Linear's GraphQL envelope) surface
  // errors as an array of objects with a `message` / `long_message` field.
  errors?: unknown;
}

/**
 * Extracts a human-readable detail string from an RFC-7807 problem JSON body
 * (or a plain `{ error }` body) without echoing anything else from the response.
 * Returns undefined when the body is not parseable JSON.
 */
export async function extractProblemDetail(
  response: Response,
): Promise<{ detail?: string; code?: string; isProblemJson: boolean }> {
  const contentType = response.headers.get('content-type') ?? '';
  // Platform-originated errors are identified strictly by the RFC-7807 content
  // type. A provider error body that merely *looks* problem-shaped (e.g.
  // ASP.NET ProblemDetails served as application/json) must not be
  // misclassified as a platform error.
  const isProblemJson = contentType.includes('application/problem+json');
  try {
    const data = (await response.clone().json()) as ProblemJson;
    if (data && typeof data === 'object') {
      const code = typeof data.code === 'string' ? data.code : undefined;
      for (const field of ['detail', 'title', 'error'] as const) {
        const value = data[field];
        if (typeof value === 'string' && value) {
          return { detail: truncate(value), code, isProblemJson };
        }
        // OpenAI and similar providers nest the message: `{ "error": { "message": "..." } }`.
        if (field === 'error' && value && typeof value === 'object') {
          const message = value.message;
          if (typeof message === 'string' && message) {
            return { detail: truncate(message), code, isProblemJson };
          }
        }
      }
      if (Array.isArray(data.errors)) {
        const message = extractFirstArrayMessage(data.errors);
        if (message) return { detail: truncate(message), code, isProblemJson };
      }
      return { code, isProblemJson };
    }
  } catch {
    // Non-JSON body: fall through without echoing it.
  }
  return { isProblemJson };
}
