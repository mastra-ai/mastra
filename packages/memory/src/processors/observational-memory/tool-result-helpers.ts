import { estimateTokenCount } from 'tokenx';

import { safeSlice } from './string-utils';

const ENCRYPTED_CONTENT_KEY = 'encryptedContent';
const ENCRYPTED_CONTENT_REDACTION_THRESHOLD = 256;

export const DEFAULT_OBSERVER_TOOL_RESULT_MAX_TOKENS = 10_000;

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
  if (mastraMetadata && typeof mastraMetadata === 'object' && 'modelOutput' in mastraMetadata) {
    return {
      value: (mastraMetadata as Record<string, unknown>).modelOutput,
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

  const totalTokens = estimateTokenCount(text);
  if (totalTokens <= maxTokens) {
    return text;
  }

  const buildCandidate = (sliceEnd: number) => {
    const visible = safeSlice(text, sliceEnd);
    return `${visible}\n... [truncated ~${totalTokens - estimateTokenCount(visible)} tokens]`;
  };

  let low = 0;
  let high = text.length;
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
