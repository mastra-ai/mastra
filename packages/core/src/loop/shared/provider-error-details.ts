/**
 * Diagnostic fields of a provider HTTP failure (AI SDK `APICallError`).
 *
 * When a provider's error body doesn't match the shape the AI SDK expects, the
 * error `message` falls back to the HTTP status text ("Bad Request"), and the
 * real explanation is only in `responseBody`. These helpers pull out the fields
 * worth keeping without trusting the error object: getters may throw, fields
 * may be any type, and bodies may be huge.
 */

export const MAX_PERSISTED_RESPONSE_BODY_LENGTH = 2000;

const REQUEST_ID_HEADERS = ['request-id', 'x-request-id'];

export type ProviderErrorDetails = {
  statusCode?: number;
  responseBody?: string;
  requestId?: string;
};

function readField(error: object, field: string): unknown {
  try {
    return (error as Record<string, unknown>)[field];
  } catch {
    return undefined;
  }
}

function readRequestId(headers: unknown): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  for (const header of REQUEST_ID_HEADERS) {
    const value = readField(headers, header);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

export function readProviderErrorDetails(error: unknown): ProviderErrorDetails {
  if (error === null || (typeof error !== 'object' && typeof error !== 'function')) return {};

  const details: ProviderErrorDetails = {};

  const statusCode = readField(error, 'statusCode');
  if (typeof statusCode === 'number' && Number.isInteger(statusCode)) details.statusCode = statusCode;

  const responseBody = readField(error, 'responseBody');
  if (typeof responseBody === 'string' && responseBody.trim()) {
    details.responseBody =
      responseBody.length > MAX_PERSISTED_RESPONSE_BODY_LENGTH
        ? `${responseBody.slice(0, MAX_PERSISTED_RESPONSE_BODY_LENGTH)}…`
        : responseBody;
  }

  const requestId = readRequestId(readField(error, 'responseHeaders'));
  if (requestId) details.requestId = requestId;

  return details;
}

/**
 * The provider's own explanation from a response body: `error.message` (Anthropic,
 * OpenAI), a top-level `message`, or the raw text when the body isn't JSON.
 */
function providerExplanation(responseBody: string): string {
  try {
    const parsed = JSON.parse(responseBody) as { error?: { message?: unknown } | string; message?: unknown };
    if (parsed && typeof parsed === 'object') {
      const nested = typeof parsed.error === 'object' ? parsed.error?.message : parsed.error;
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
      if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message.trim();
    }
  } catch {
    // Not JSON; show the raw text.
  }
  return responseBody.trim();
}

/**
 * Human-readable one-liner for a provider HTTP failure, or undefined when the
 * error carries no HTTP details. Example:
 * `Bad Request (HTTP 400): prompt is too long (request id req_123)`.
 */
export function describeProviderError(message: string, details: ProviderErrorDetails): string | undefined {
  if (details.statusCode === undefined && details.responseBody === undefined) return undefined;

  let text = message;
  if (details.statusCode !== undefined) text += ` (HTTP ${details.statusCode})`;

  if (details.responseBody !== undefined) {
    const explanation = providerExplanation(details.responseBody);
    if (explanation && explanation !== message) text += `: ${explanation}`;
  } else if (details.statusCode !== undefined) {
    text += ': empty response body';
  }

  if (details.requestId) text += ` (request id ${details.requestId})`;
  return text;
}
