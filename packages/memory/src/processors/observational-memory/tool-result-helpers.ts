import { estimateTokenCount } from 'tokenx';

import { safeSlice } from './string-utils';

const ENCRYPTED_CONTENT_KEY = 'encryptedContent';
const ENCRYPTED_CONTENT_REDACTION_THRESHOLD = 256;

export const DEFAULT_OBSERVER_TOOL_RESULT_MAX_TOKENS = 5_000;

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeToolResultValue(value: unknown, seen: WeakMap<object, unknown> = new WeakMap()): unknown {
  if (!isObjectLike(value)) {
    return value;
  }

  if (seen.has(value)) {
    return seen.get(value);
  }

  // Count what storage and the model see: JSON.stringify serializes a value through its toJSON().
  const toJSON = (value as { toJSON?: unknown }).toJSON;
  if (typeof toJSON === 'function') {
    const json = toJSON.call(value);
    if (json !== value) return sanitizeToolResultValue(json, seen);
  }

  if (Array.isArray(value)) {
    const sanitizedArray: unknown[] = [];
    seen.set(value, sanitizedArray);
    for (const item of value) {
      sanitizedArray.push(sanitizeToolResultValue(item, seen));
    }
    return sanitizedArray;
  }

  const sanitizedObject: Record<string, unknown> = {};
  seen.set(value, sanitizedObject);

  for (const [key, entry] of Object.entries(value)) {
    if (
      key === ENCRYPTED_CONTENT_KEY &&
      typeof entry === 'string' &&
      entry.length > ENCRYPTED_CONTENT_REDACTION_THRESHOLD
    ) {
      sanitizedObject[key] = `[stripped encryptedContent: ${entry.length} characters]`;
      continue;
    }

    sanitizedObject[key] = sanitizeToolResultValue(entry, seen);
  }

  return sanitizedObject;
}

/**
 * Serializes a tool result without truncating it.
 *
 * Token accounting must see the full result: the truncation applied by
 * {@link formatToolResultForObserver} exists to bound what the Observer LLM reads,
 * not to describe what the agent's provider context actually holds.
 */
export function serializeToolResultForTokenCounting(value: unknown): string {
  return stringifyToolResult(value);
}

/**
 * Returns a tool invocation's `errorText` as a string. The field is typed as a string, but
 * persisted or imported history can hold a structured error object, so anything that is not
 * a string is serialized. Nullish values become an empty string.
 */
export function toolErrorTextToString(errorText: unknown): string {
  return errorText == null ? '' : stringifyToolResult(errorText);
}

function stringifyToolResult(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  const sanitized = sanitizeToolResultValue(value);
  try {
    return JSON.stringify(sanitized, null, 2);
  } catch {
    return String(sanitized);
  }
}

export function resolveToolResultValue(
  part: { providerMetadata?: Record<string, any> } | undefined,
  invocationResult: unknown,
): {
  value: unknown;
  usingStoredModelOutput: boolean;
} {
  const mastraMetadata = part?.providerMetadata?.mastra;
  // A nullish `modelOutput` means no mapping applied (e.g. completed background
  // tasks clear the dispatch placeholder with `null`); fall back to the raw result.
  const modelOutput = mastraMetadata && typeof mastraMetadata === 'object' ? mastraMetadata.modelOutput : undefined;
  if (modelOutput != null) {
    return {
      value: modelOutput,
      usingStoredModelOutput: true,
    };
  }

  return {
    value: invocationResult,
    usingStoredModelOutput: false,
  };
}

const PREFIX_CHUNK_MIN_LENGTH = 256;

function isAsciiAlphanumeric(code: number): boolean {
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isSplitWhitespace(code: number): boolean {
  return code === 32 || code === 10 || code === 9 || code === 13;
}

/**
 * Returns a function that counts `estimateTokenCount(text.slice(0, end) + suffix)` without rescanning the
 * whole prefix on every call.
 *
 * tokenx splits text into segments on whitespace and punctuation runs and sums a per-segment estimate.
 * Letters and digits are never separators and whitespace always is, so the position between an ASCII
 * letter or digit and a following whitespace character is always a segment boundary: the count of any
 * string that shares the text up to such a position equals the count before it plus the count after it.
 * The text is cut at those boundaries once, and each call only rescans the chunk it ends in.
 */
function createPrefixTokenCounter(text: string): (end: number, suffix?: string) => number {
  const boundaries: number[] = [0];
  const tokensBefore: number[] = [0];
  let chunkStart = 0;
  let runningTokens = 0;
  for (let i = PREFIX_CHUNK_MIN_LENGTH; i < text.length; i++) {
    if (
      i - chunkStart >= PREFIX_CHUNK_MIN_LENGTH &&
      isSplitWhitespace(text.charCodeAt(i)) &&
      isAsciiAlphanumeric(text.charCodeAt(i - 1))
    ) {
      runningTokens += estimateTokenCount(text.slice(chunkStart, i));
      boundaries.push(i);
      tokensBefore.push(runningTokens);
      chunkStart = i;
    }
  }

  return (end, suffix = '') => {
    let low = 0;
    let high = boundaries.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (boundaries[mid]! <= end) low = mid;
      else high = mid - 1;
    }
    return tokensBefore[low]! + estimateTokenCount(text.slice(boundaries[low]!, end) + suffix);
  };
}

export function truncateStringByTokens(text: string, maxTokens: number): string {
  if (!text || maxTokens <= 0) {
    return '';
  }

  const countPrefixTokens = createPrefixTokenCounter(text);
  const totalTokens = countPrefixTokens(text.length);
  if (totalTokens <= maxTokens) {
    return text;
  }

  // The truncation marker starts with a newline, so the candidate's count only rescans the chunk where
  // the visible text ends.
  const buildCandidate = (sliceEnd: number) => {
    const visibleEnd = safeSlice(text, sliceEnd).length;
    const suffix = `\n... [truncated ~${totalTokens - countPrefixTokens(visibleEnd)} tokens]`;
    return { visibleEnd, suffix, tokens: countPrefixTokens(visibleEnd, suffix) };
  };

  let low = 0;
  let high = text.length;
  let best = buildCandidate(0);

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = buildCandidate(mid);

    if (candidate.tokens <= maxTokens) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return text.slice(0, best.visibleEnd) + best.suffix;
}

export function formatToolResultForObserver(
  value: unknown,
  options?: {
    maxTokens?: number;
  },
): string {
  const serialized = stringifyToolResult(value);
  const maxTokens = options?.maxTokens ?? DEFAULT_OBSERVER_TOOL_RESULT_MAX_TOKENS;
  return truncateStringByTokens(serialized, maxTokens);
}
