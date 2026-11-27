import type { UsageStats } from '@mastra/core/observability';

/**
 * LangSmithUsageMetrics
 *
 * Canonical metric keys expected by LangSmith for LLM usage accounting.
 * See: https://docs.langchain.com/langsmith/log-llm-trace#provide-token-and-cost-information
 */
export interface LangSmithUsageMetrics {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_token_details?: {
    [key: string]: number;
  };
  output_token_details?: {
    [key: string]: number;
  };
}

/**
 * Formats UsageStats to LangSmith's expected metric format.
 */
export function formatUsageMetrics(usage?: UsageStats): LangSmithUsageMetrics {
  const metrics: LangSmithUsageMetrics = {};

  if (usage?.inputTokens !== undefined) {
    metrics.input_tokens = usage.inputTokens;
  }

  if (usage?.outputTokens !== undefined) {
    metrics.output_tokens = usage.outputTokens;
  }

  // Compute total if we have both
  if (metrics.input_tokens !== undefined && metrics.output_tokens !== undefined) {
    metrics.total_tokens = metrics.input_tokens + metrics.output_tokens;
  }

  if (usage?.outputDetails?.reasoning !== undefined) {
    metrics.output_token_details = {
      ...(metrics.output_token_details ?? {}),
      reasoning_tokens: usage.outputDetails.reasoning,
    };
  }

  if (usage?.inputDetails?.cacheRead !== undefined) {
    metrics.input_token_details = {
      ...(metrics.input_token_details ?? {}),
      cache_read: usage.inputDetails.cacheRead,
    };
  }

  if (usage?.inputDetails?.cacheWrite !== undefined) {
    metrics.input_token_details = {
      ...(metrics.input_token_details ?? {}),
      cache_write: usage.inputDetails.cacheWrite,
    };
  }

  if (usage?.inputDetails?.cacheWrite5m !== undefined) {
    metrics.input_token_details = {
      ...(metrics.input_token_details ?? {}),
      cache_creation_5m: usage.inputDetails.cacheWrite5m,
    };
  }

  if (usage?.inputDetails?.cacheWrite1h !== undefined) {
    metrics.input_token_details = {
      ...(metrics.input_token_details ?? {}),
      cache_creation_1h: usage.inputDetails.cacheWrite1h,
    };
  }

  if (usage?.inputDetails?.audio !== undefined) {
    metrics.input_token_details = {
      ...(metrics.input_token_details ?? {}),
      audio: usage.inputDetails.audio,
    };
  }

  if (usage?.outputDetails?.audio !== undefined) {
    metrics.output_token_details = {
      ...(metrics.output_token_details ?? {}),
      audio: usage.outputDetails.audio,
    };
  }

  return metrics;
}

type Counts = { [key: string]: number | Counts | undefined };

function combine(a: Counts, b: Counts, operation: (x: number, y: number) => number): Counts {
  return Object.fromEntries(
    [...new Set([...Object.keys(a), ...Object.keys(b)])].map(key => {
      const [x, y] = [a[key], b[key]];
      return typeof (x ?? y) === 'object'
        ? [key, combine((x ?? {}) as Counts, (y ?? {}) as Counts, operation)]
        : [key, operation((x ?? 0) as number, (y ?? 0) as number)];
    }),
  );
}

export function addUsage(a: LangSmithUsageMetrics, b: LangSmithUsageMetrics): LangSmithUsageMetrics {
  return combine(a as Counts, b as Counts, (x, y) => x + y);
}

/** What `total` has on top of `counted`, or undefined when nothing is left. */
export function usageLeft(
  total: LangSmithUsageMetrics,
  counted: LangSmithUsageMetrics,
): LangSmithUsageMetrics | undefined {
  const left: LangSmithUsageMetrics = combine(total as Counts, counted as Counts, (x, y) => Math.max(0, x - y));
  left.total_tokens = (left.input_tokens ?? 0) + (left.output_tokens ?? 0);
  return left.total_tokens > 0 ? left : undefined;
}
