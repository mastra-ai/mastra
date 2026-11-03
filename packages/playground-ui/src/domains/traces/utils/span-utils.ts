import type { SpanRecord } from '../types';
import { getSignalInputPreview } from './span-signal';
import { toDate } from '@/utils/date-format';

type MessageLike = { role?: string; content?: unknown };

export function getSpanDurationMs(
  startedAt: Date | string | null | undefined,
  endedAt: Date | string | null | undefined,
): number | undefined {
  const startedAtMs = toDate(startedAt)?.getTime();
  const endedAtMs = toDate(endedAt)?.getTime();
  if (startedAtMs === undefined || endedAtMs === undefined || endedAtMs < startedAtMs) return undefined;
  return endedAtMs - startedAtMs;
}

export function getInputPreview(input: unknown, maxLength = 100): string {
  if (input == null) return '';

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

    const joined = userMessages.join('; ');
    if (joined.length > maxLength) {
      return joined.slice(0, maxLength) + '…';
    }
    return joined;
  }

  const signalPreview = getSignalInputPreview(input);
  if (signalPreview !== undefined) {
    return signalPreview.length > maxLength ? signalPreview.slice(0, maxLength) + '…' : signalPreview;
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

export function isTokenLimitExceeded(span?: SpanRecord): boolean {
  return span?.attributes?.finishReason === 'length';
}

export function getTokenLimitMessage(span?: SpanRecord): string {
  const usage = span?.attributes?.usage as TokenUsage | undefined;

  if (!usage) {
    return `The model stopped generating because it reached the maximum token limit. The response was truncated and may be incomplete.`;
  }

  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;

  if (inputTokens > 0 || outputTokens > 0) {
    return `The model stopped generating because it reached the maximum token limit. The response was truncated and may be incomplete.\n\nToken usage: ${inputTokens} input + ${outputTokens} output = ${totalTokens} total`;
  }

  return `The model stopped generating because it reached the maximum token limit (${totalTokens} tokens). The response was truncated and may be incomplete.`;
}
