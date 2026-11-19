import { estimateTokenCount } from 'tokenx';

import { safeSlice } from './string-utils';

const ENCRYPTED_CONTENT_KEY = 'encryptedContent';
const ENCRYPTED_CONTENT_REDACTION_THRESHOLD = 256;

export const DEFAULT_OBSERVER_TOOL_RESULT_MAX_TOKENS = 5_000;

/**
 * Upper bound on characters per token for tokenx's default estimator: it never
 * estimates below one token per 6 default characters. Multiplying a token budget
 * by this bounds the characters that can hold it, so truncation never has to
 * tokenise the whole (possibly multi-megabyte) string.
 */
const MAX_CHARS_PER_TOKEN = 8;

/** Texts up to this many characters get an exact token total in their notice. */
const TOTAL_TOKENS_EXACT_LIMIT = 1_000_000;
/** Characters sampled from each of three windows to extrapolate a large total. */
const TOTAL_SAMPLE_CHARS = 32_768;

/**
 * Estimated token total for a truncation notice. Exact for texts up to
 * {@link TOTAL_TOKENS_EXACT_LIMIT}; above it, three fixed-size windows (start,
 * middle, end) are counted and scaled by the length ratio, so the cost no longer
 * grows with the input size.
 */
function estimateTotalTokens(text: string): number {
  if (text.length <= TOTAL_TOKENS_EXACT_LIMIT) return estimateTokenCount(text);

  const sampleStart = estimateTokenCount(text.slice(0, TOTAL_SAMPLE_CHARS));
  const middleStart = Math.floor((text.length - TOTAL_SAMPLE_CHARS) / 2);
  const sampleMiddle = estimateTokenCount(text.slice(middleStart, middleStart + TOTAL_SAMPLE_CHARS));
  const sampleEnd = estimateTokenCount(text.slice(-TOTAL_SAMPLE_CHARS));

  const sampledTokens = sampleStart + sampleMiddle + sampleEnd;
  return Math.round((sampledTokens / (TOTAL_SAMPLE_CHARS * 3)) * text.length);
}

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

export function truncateStringByTokens(text: string, maxTokens: number): string {
  if (!text || maxTokens <= 0) {
    return '';
  }

  // tokenx never estimates below one token per 6 characters, so only text within
  // `maxTokens * MAX_CHARS_PER_TOKEN` characters can still fit; anything longer is
  // known to exceed the budget without counting it in full.
  if (text.length <= maxTokens * MAX_CHARS_PER_TOKEN && estimateTokenCount(text) <= maxTokens) {
    return text;
  }

  const totalTokens = estimateTotalTokens(text);

  const buildCandidate = (sliceEnd: number) => {
    const visible = safeSlice(text, sliceEnd);
    return `${visible}\n... [truncated ~${totalTokens - estimateTokenCount(visible)} tokens]`;
  };

  let low = 0;
  // Bound the search to the characters that can hold the budget, so no iteration
  // tokenises a near-full copy of a multi-megabyte input.
  let high = Math.min(text.length, maxTokens * MAX_CHARS_PER_TOKEN);
  let best = buildCandidate(0);

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = buildCandidate(mid);
    const candidateTokens = estimateTokenCount(candidate);

    if (candidateTokens <= maxTokens) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
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
