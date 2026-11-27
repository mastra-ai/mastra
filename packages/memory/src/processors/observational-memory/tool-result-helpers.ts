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

/**
 * tokenx is synchronous and allocates per word, so tokenizing a multi-MB tool result
 * blocks the event loop for seconds, and the cut below tokenizes it about 25 times.
 * Text up to this many chars per token of budget is counted and cut exactly. Longer
 * text is scanned once without allocating and only a bounded window is tokenized.
 */
const EXACT_CHARS_PER_TOKEN = 32;

/**
 * tokenx never counts a non-whitespace segment as fewer than one token per 8 UTF-16
 * chars, so a prefix with more non-whitespace chars than `maxTokens * 8` is over budget.
 */
const MAX_CHARS_PER_TOKEN = 8;

/** Room in the window for the truncation notice and for segments tokenx counts above the floor. */
const WINDOW_HEADROOM_CHARS = 256;

/** Upper bound on the window, in chars per token of budget, so whitespace padding can't grow it. */
const MAX_WINDOW_CHARS_PER_TOKEN = 24;

const WS = 0;
const PUNCT = 1;
const WORD = 2;
const CHAR_CLASS = new Uint8Array(128).fill(WORD);
for (const c of ' \t\n\r\v\f') CHAR_CLASS[c.charCodeAt(0)] = WS;
for (const c of '.,!?;(){}[]<>:/\\|@#$%^&*+=`~_"-') CHAR_CLASS[c.charCodeAt(0)] = PUNCT;

/** Same set as the regex `\s`, which is what tokenx splits words on. */
function isWhitespaceCode(code: number): boolean {
  return (
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  );
}

/** tokenx counts a whitespace run as 1 token when it holds a newline followed by more whitespace (indentation, blank lines). */
function runTokens(kind: number, length: number, onlyDigits: boolean, structured: boolean): number {
  if (kind === WS) return structured ? 1 : 0;
  if (length <= 3) return 1;
  if (kind === PUNCT) return Math.ceil(length / 2);
  return onlyDigits ? Math.ceil(length / 3) : Math.ceil(length / 6);
}

/**
 * One allocation-free pass: an approximate token count of the whole text (tokenx's
 * rules for ASCII; non-ASCII words count as English, so accented and Cyrillic text
 * is undercounted and CJK much more so; used only for the "~N tokens" total)
 * and the index just past the first `nonWhitespaceLimit` non-whitespace chars.
 */
function scanText(text: string, nonWhitespaceLimit: number, windowCap: number): { approx: number; windowEnd: number } {
  let approx = 0;
  let nonWhitespace = 0;
  let windowEnd = -1;
  let kind = -1;
  let length = 0;
  let onlyDigits = true;
  let structured = false;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const cls = code < 128 ? CHAR_CLASS[code]! : isWhitespaceCode(code) ? WS : WORD;
    if (cls !== kind) {
      if (length) approx += runTokens(kind, length, onlyDigits, structured);
      kind = cls;
      length = 0;
      onlyDigits = true;
      structured = false;
    } else if (cls === WS && text.charCodeAt(i - 1) === 10) {
      structured = true;
    }
    length++;
    if (cls !== WS) nonWhitespace++;
    if (code < 48 || code > 57) onlyDigits = false;
    if (windowEnd < 0 && (nonWhitespace > nonWhitespaceLimit || i + 1 >= windowCap)) windowEnd = i + 1;
  }
  if (length) approx += runTokens(kind, length, onlyDigits, structured);
  return { approx, windowEnd: windowEnd < 0 ? text.length : windowEnd };
}

/**
 * Cuts `text` to fit `maxTokens` and says how many tokens were dropped. Text within
 * `maxTokens * 32` chars is cut exactly. Longer text keeps the longest prefix that fits
 * inside a bounded window at its start (the window ends past `maxTokens * 8`
 * non-whitespace chars, which is always over budget, or at `maxTokens * 24` chars when
 * whitespace padding comes first, so such text may keep less than the budget allows).
 * Its "~N tokens" total is approximate.
 */
export function truncateStringByTokens(text: string, maxTokens: number): string {
  if (!text || maxTokens <= 0) {
    return '';
  }

  let searchEnd = text.length;
  let totalTokens: number;
  if (text.length <= maxTokens * EXACT_CHARS_PER_TOKEN) {
    totalTokens = estimateTokenCount(text);
    if (totalTokens <= maxTokens) {
      return text;
    }
  } else {
    const scan = scanText(
      text,
      maxTokens * MAX_CHARS_PER_TOKEN + WINDOW_HEADROOM_CHARS,
      maxTokens * MAX_WINDOW_CHARS_PER_TOKEN,
    );
    totalTokens = scan.approx;
    searchEnd = scan.windowEnd;
  }

  const buildCandidate = (sliceEnd: number) => {
    const visible = safeSlice(text, sliceEnd);
    return `${visible}\n... [truncated ~${Math.max(0, totalTokens - estimateTokenCount(visible))} tokens]`;
  };

  let low = 0;
  let high = searchEnd;
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
