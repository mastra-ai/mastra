import { estimateTokenCount } from 'tokenx';

import { safeSlice } from './string-utils';

const ENCRYPTED_CONTENT_KEY = 'encryptedContent';
const ENCRYPTED_CONTENT_REDACTION_THRESHOLD = 256;

export const DEFAULT_OBSERVER_TOOL_RESULT_MAX_TOKENS = 5_000;

/** The string a boxed `String` serializes to; JSON.stringify unboxes it only after the replacer has run. */
function unboxedString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || value === null) return undefined;
  try {
    String.prototype.valueOf.call(value);
  } catch {
    return undefined;
  }
  return String(value);
}

/** Redacts long `encryptedContent` strings: opaque provider data that would otherwise dominate the count. */
function redactEncryptedContent(key: string, value: unknown): unknown {
  if (key !== ENCRYPTED_CONTENT_KEY) return value;
  const text = unboxedString(value);
  return text !== undefined && text.length > ENCRYPTED_CONTENT_REDACTION_THRESHOLD
    ? `[stripped encryptedContent: ${text.length} characters]`
    : value;
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

/**
 * Serializes with `JSON.stringify` itself, the serializer storage uses, so a count of this text describes what
 * storage holds and a reload reads back (`toJSON()`, boxed primitives, class instances, array indices).
 */
function stringifyToolResult(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  let json: string | undefined;
  try {
    json = JSON.stringify(value, redactEncryptedContent, 2);
  } catch {
    // Cycles and BigInt: storage cannot write these either.
    return String(value);
  }
  if (json === undefined) return '';
  // A value that serializes to a string (a boxed string, a toJSON() returning one) reloads as that raw string.
  return json.startsWith('"') ? (JSON.parse(json) as string) : json;
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
