import type { SpanRecord } from '@mastra/core/storage';
import { format } from 'date-fns';

type MessageLike = { role?: string; content?: unknown };

function toTimestamp(value: Date | string | null | undefined): number | undefined {
  if (value == null) return undefined;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function getSpanDurationMs(
  startedAt: Date | string | null | undefined,
  endedAt: Date | string | null | undefined,
): number | undefined {
  const startedAtMs = toTimestamp(startedAt);
  const endedAtMs = toTimestamp(endedAt);
  if (startedAtMs === undefined || endedAtMs === undefined || endedAtMs < startedAtMs) return undefined;
  return endedAtMs - startedAtMs;
}

export function formatSpanDuration(
  startedAt: Date | string | null | undefined,
  endedAt: Date | string | null | undefined,
): string | undefined {
  const durationMs = getSpanDurationMs(startedAt, endedAt);
  if (durationMs === undefined) return undefined;
  return durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`;
}

export function formatSpanDurationExact(
  startedAt: Date | string | null | undefined,
  endedAt: Date | string | null | undefined,
): string | undefined {
  const durationMs = getSpanDurationMs(startedAt, endedAt);
  if (durationMs === undefined) return undefined;
  return durationMs < 1000 ? `${durationMs}ms` : `${durationMs / 1000}s`;
}

export function formatSpanTimestamp(value: Date | string | null | undefined): string | undefined {
  const timestamp = toTimestamp(value);
  return timestamp === undefined ? undefined : format(new Date(timestamp), 'h:mm:ss a');
}

export function formatSpanTimestampExact(value: Date | string | null | undefined): string | undefined {
  const timestamp = toTimestamp(value);
  return timestamp === undefined ? undefined : format(new Date(timestamp), 'MMM d, yyyy, h:mm:ss.SSS a');
}

/**
 * Extract a truncated text preview from a span's input field.
 * Agent traces store `input` as an array of message objects.
 * Returns the text content of all user messages joined, truncated to maxLength.
 */
export function getInputPreview(input: unknown, maxLength = 100): string {
  if (input == null) return '';

  // Unwrap legacy { messages: [...] } wrapper from agent_run spans
  const messageArray = Array.isArray(input)
    ? input
    : input && typeof input === 'object' && !Array.isArray(input) && Array.isArray((input as any).messages)
      ? (input as any).messages
      : null;

  if (messageArray) {
    const messages = messageArray as MessageLike[];
    const userMessages = messages
      .filter(m => m?.role === 'user')
      .map(m => {
        if (typeof m.content === 'string') return m.content;
        if (Array.isArray(m.content)) {
          return m.content
            .map((part: any) => {
              if (typeof part === 'string') return part;
              if (part?.type === 'text' && typeof part.text === 'string') return part.text;
              return '';
            })
            .filter(Boolean)
            .join(' ');
        }
        return '';
      })
      .filter(Boolean);

    const joined = userMessages.join(' | ');
    if (joined.length > maxLength) {
      return joined.slice(0, maxLength) + '…';
    }
    return joined;
  }

  if (typeof input === 'string') {
    if (input.length > maxLength) {
      return input.slice(0, maxLength) + '…';
    }
    return input;
  }

  const str = JSON.stringify(input);
  if (str.length > maxLength) {
    return str.slice(0, maxLength) + '…';
  }
  return str;
}

type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

/**
 * Check if a span indicates that the token limit was exceeded
 */
export function isTokenLimitExceeded(span?: SpanRecord): boolean {
  return span?.attributes?.finishReason === 'length';
}

/**
 * Get a human-readable message for token limit exceeded
 */
export function getTokenLimitMessage(span?: SpanRecord): string {
  const usage = span?.attributes?.usage as TokenUsage | undefined;

  if (!usage) {
    return `The model stopped generating because it reached the maximum token limit. The response was truncated and may be incomplete.`;
  }

  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;

  // Show breakdown if we have detailed info
  if (inputTokens > 0 || outputTokens > 0) {
    return `The model stopped generating because it reached the maximum token limit. The response was truncated and may be incomplete.\n\nToken usage: ${inputTokens} input + ${outputTokens} output = ${totalTokens} total`;
  }

  return `The model stopped generating because it reached the maximum token limit (${totalTokens} tokens). The response was truncated and may be incomplete.`;
}
