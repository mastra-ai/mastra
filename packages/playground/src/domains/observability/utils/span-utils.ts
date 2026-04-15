import type { SpanRecord } from '@mastra/core/storage';

type MessageLike = { role?: string; content?: unknown };

/**
 * Extract a truncated text preview from a span's input field.
 * Agent traces store `input` as an array of message objects.
 * Returns the text content of all user messages joined, truncated to maxLength.
 */
export function getInputPreview(input: unknown, maxLength = 100): string {
  if (input == null) return '';

  if (Array.isArray(input)) {
    const messages = input as MessageLike[];
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
