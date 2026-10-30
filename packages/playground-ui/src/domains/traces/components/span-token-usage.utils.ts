import type { UsageStats } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { getSpanDurationMs } from '../utils/span-utils';
import { formatDuration } from '@/utils/duration';

export type TokenUsageRow = {
  label: 'Input' | 'Output';
  total: number;
  /** Non-zero breakdown, e.g. `5,632 cached · 974 text`. */
  breakdown: string | undefined;
};

const BREAKDOWN_PARTS = [
  ['cacheRead', 'cached'],
  ['cacheWrite', 'cache write'],
  ['reasoning', 'reasoning'],
  ['text', 'text'],
  ['audio', 'audio'],
  ['image', 'image'],
] as const;

function formatBreakdown(details: object | undefined): string | undefined {
  if (!details) return undefined;
  const parts = BREAKDOWN_PARTS.flatMap(([key, label]) => {
    const value: unknown = (details as Record<string, unknown>)[key];
    return typeof value === 'number' && value > 0 ? [`${value.toLocaleString()} ${label}`] : [];
  });
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/** One row per direction that reports a token count; null when neither does. */
export function getTokenUsageRows(usage: UsageStats | undefined | null): TokenUsageRow[] | null {
  if (!usage) return null;
  const rows: TokenUsageRow[] = [];
  if (typeof usage.inputTokens === 'number') {
    rows.push({ label: 'Input', total: usage.inputTokens, breakdown: formatBreakdown(usage.inputDetails) });
  }
  if (typeof usage.outputTokens === 'number') {
    rows.push({ label: 'Output', total: usage.outputTokens, breakdown: formatBreakdown(usage.outputDetails) });
  }
  return rows.length > 0 ? rows : null;
}

export type ModelFacts = {
  model?: string;
  provider?: string;
  finishReason?: string;
  firstToken?: string;
  speed?: string;
};

type ModelSpan = {
  spanType?: string | null;
  startedAt: Date | string;
  endedAt?: Date | string | null;
  attributes?: Record<string, unknown> | null;
};

const MODEL_SPAN_TYPES: ReadonlySet<string> = new Set([
  SpanType.MODEL_GENERATION,
  SpanType.MODEL_STEP,
  SpanType.MODEL_INFERENCE,
]);

const asString = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined);

/**
 * Model, finish reason, time to first token and output speed of a model span.
 * Other spans get none; each fact is left out when the span doesn't record what it needs.
 */
export function getModelFacts(span: ModelSpan): ModelFacts {
  if (!span.spanType || !MODEL_SPAN_TYPES.has(span.spanType)) return {};
  const attributes = span.attributes ?? {};
  const completionStartTime =
    attributes.completionStartTime instanceof Date
      ? attributes.completionStartTime
      : asString(attributes.completionStartTime);
  const usage = attributes.usage as UsageStats | undefined;

  const firstTokenMs = getSpanDurationMs(span.startedAt, completionStartTime);
  const streamingMs = getSpanDurationMs(completionStartTime, span.endedAt);
  const outputTokens = usage?.outputTokens;
  const tokensPerSecond =
    typeof outputTokens === 'number' && outputTokens > 0 && streamingMs
      ? (outputTokens / streamingMs) * 1_000
      : undefined;

  return {
    model: asString(attributes.model),
    provider: asString(attributes.provider),
    finishReason: asString(attributes.finishReason),
    firstToken: completionStartTime ? formatDuration(firstTokenMs) : undefined,
    speed: tokensPerSecond === undefined ? undefined : `${Math.round(tokensPerSecond).toLocaleString()} tok/s`,
  };
}
