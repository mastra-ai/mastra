import { SpanType } from '@mastra/core/observability';
import type { SpanRecord } from '../types';
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

type TraceTreeSpan = {
  spanId: string;
  parentSpanId?: string | null;
  spanType: string;
  startedAt: Date | string;
};

export type TraceModel = { model: string; provider?: string };

/**
 * The model an agent run used. The `agent_run` span carries no model, so this reads the
 * earliest `model_generation` span of its subtree, without descending into sub-agents.
 * `attributes` is only present on full span payloads; light spans yield `undefined`.
 */
export function getTraceModel(spans: readonly TraceTreeSpan[], rootSpanId: string): TraceModel | undefined {
  const root = spans.find(span => span.spanId === rootSpanId);
  if (root?.spanType !== SpanType.AGENT_RUN) return undefined;

  const childrenByParent = new Map<string, TraceTreeSpan[]>();
  for (const span of spans) {
    if (!span.parentSpanId) continue;
    const siblings = childrenByParent.get(span.parentSpanId);
    if (siblings) siblings.push(span);
    else childrenByParent.set(span.parentSpanId, [span]);
  }

  let earliest: (TraceModel & { startedAtMs: number }) | undefined;
  const stack = [...(childrenByParent.get(rootSpanId) ?? [])];
  for (let span = stack.pop(); span; span = stack.pop()) {
    if (span.spanType === SpanType.AGENT_RUN) continue;
    stack.push(...(childrenByParent.get(span.spanId) ?? []));
    if (span.spanType !== SpanType.MODEL_GENERATION) continue;

    const attributes = 'attributes' in span ? span.attributes : undefined;
    if (!attributes || typeof attributes !== 'object') continue;
    const { model, provider } = attributes as Record<string, unknown>;
    if (typeof model !== 'string' || !model) continue;

    const startedAtMs = toDate(span.startedAt)?.getTime() ?? Number.POSITIVE_INFINITY;
    if (earliest && earliest.startedAtMs <= startedAtMs) continue;
    earliest = { model, provider: typeof provider === 'string' && provider ? provider : undefined, startedAtMs };
  }

  return earliest && { model: earliest.model, provider: earliest.provider };
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
