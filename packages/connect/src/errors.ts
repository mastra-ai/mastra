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
  let isProblemJson = contentType.includes('application/problem+json');
  try {
    const data = (await response.clone().json()) as ProblemJson;
    if (data && typeof data === 'object') {
      // RFC-7807 shape fallback: some platform responses use a plain JSON
      // content type but still carry the problem structure.
      if (!isProblemJson && typeof data.title === 'string' && typeof data.status === 'number') {
        isProblemJson = true;
      }
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
