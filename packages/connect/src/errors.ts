export type MastraConnectErrorCode =
  | 'missing_access_token'
  | 'missing_project_id'
  | 'missing_connection_id'
  | 'connection_not_found'
  | 'multiple_connections'
  | 'needs_reauth'
  | 'unauthorized'
  | 'proxy_error'
  | 'unsupported_credential_type'
  | 'platform_error';

const MAX_DETAIL_LENGTH = 2000;

export class MastraConnectError extends Error {
  readonly code: MastraConnectErrorCode;
  readonly status?: number;
  readonly detail?: string;

  constructor(code: MastraConnectErrorCode, message: string, options?: { status?: number; detail?: string }) {
    super(message);
    this.name = 'MastraConnectError';
    this.code = code;
    this.status = options?.status;
    this.detail = options?.detail ? truncate(options.detail) : undefined;
  }
}

function truncate(text: string): string {
  return text.length > MAX_DETAIL_LENGTH ? `${text.slice(0, MAX_DETAIL_LENGTH)}…` : text;
}

interface ProblemJson {
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  error?: string;
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
      }
      return { code, isProblemJson };
    }
  } catch {
    // Non-JSON body: fall through without echoing it.
  }
  return { isProblemJson };
}
