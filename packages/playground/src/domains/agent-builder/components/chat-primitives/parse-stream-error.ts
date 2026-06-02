export interface ParsedStreamError {
  summary: string;
  details?: string;
}

/**
 * Best-effort parser for the assistant message text emitted by
 * `client-sdks/react/src/lib/ai-sdk/utils/toUIMessage.ts` for `chunk.type ===
 * 'error'`. That code path stringifies the error payload as-is, so the text
 * may be either a raw string, a JSON envelope wrapping a provider error, or
 * something else entirely. We try to extract a one-line summary and stash the
 * rest under a collapsible details section.
 */
export const parseStreamErrorText = (raw: string): ParsedStreamError => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { summary: 'Something went wrong while building the agent.' };
  }

  // Heuristic: JSON envelope likely shaped like
  // `{ "message": "...", "name": "...", "responseBody": "..." }` or a nested
  // OpenAI Responses payload. Try to pull a single human-readable line.
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const candidate = extractFriendlyMessage(parsed);
      if (candidate) {
        return {
          summary: stripRequestIdSuffix(candidate),
          details: trimmed,
        };
      }
    } catch {
      // fall through to truncation
    }
  }

  const oneLine = trimmed.split('\n')[0];
  const truncated = oneLine.length > 200;
  const summary = truncated ? `${oneLine.slice(0, 200)}…` : oneLine;
  // Keep the full text recoverable whenever the summary doesn't already contain it:
  // either because we truncated a long single line, or because there are extra
  // lines below the first one.
  const details = truncated || trimmed.length > oneLine.length ? trimmed : undefined;
  return { summary, details };
};

const extractFriendlyMessage = (payload: Record<string, unknown>): string | undefined => {
  // Common shapes we have seen:
  //   { message, name, responseBody }                       — top-level Error
  //   { message: '{"type":"error","error":{...}}' }         — OpenAI envelope nested as a string
  //   { error: { message, code, type } }                    — direct provider error
  const direct = typeof payload.message === 'string' ? payload.message : undefined;
  if (direct) {
    const nested = tryParseNestedProviderError(direct);
    if (nested) return nested;
    return direct;
  }
  const nestedError = payload.error;
  if (nestedError && typeof nestedError === 'object') {
    const message = (nestedError as Record<string, unknown>).message;
    if (typeof message === 'string') return message;
  }
  return undefined;
};

const tryParseNestedProviderError = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{')) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const nestedError = parsed.error;
    if (nestedError && typeof nestedError === 'object') {
      const message = (nestedError as Record<string, unknown>).message;
      if (typeof message === 'string') return message;
    }
    if (typeof parsed.message === 'string') return parsed.message;
  } catch {
    return undefined;
  }
  return undefined;
};

const stripRequestIdSuffix = (message: string): string => {
  const marker = 'please include the request id';
  const idx = message.toLowerCase().indexOf(marker);
  if (idx === -1) return message.trim();
  // Drop from the marker through the next period (if any) to end of string.
  const tail = message.slice(idx);
  const periodIdx = tail.indexOf('.');
  const cutEnd = periodIdx === -1 ? message.length : idx + periodIdx + 1;
  return (message.slice(0, idx) + message.slice(cutEnd)).trim();
};
