import type { UsageStats } from '@mastra/core/observability';
import { TokenMetrics } from './types';

export interface TokenMetricSample {
  name: TokenMetrics;
  value: number;
}

export function getTokenMetricSamples(usage: UsageStats): TokenMetricSample[] {
  const samples: TokenMetricSample[] = [];
  const pushIfDefined = (name: TokenMetrics, value: number | undefined) => {
    if (value != null) {
      samples.push({ name, value });
    }
  };
  const pushIfPositive = (name: TokenMetrics, value: number | undefined) => {
    if (value != null && value > 0) {
      samples.push({ name, value });
    }
  };

  pushIfDefined(TokenMetrics.TOTAL_INPUT, usage.inputTokens);
  pushIfDefined(TokenMetrics.TOTAL_OUTPUT, usage.outputTokens);

  if (usage.inputDetails) {
    pushIfPositive(TokenMetrics.INPUT_TEXT, usage.inputDetails.text);
    pushIfPositive(TokenMetrics.INPUT_CACHE_READ, usage.inputDetails.cacheRead);
    pushIfPositive(TokenMetrics.INPUT_CACHE_WRITE, usage.inputDetails.cacheWrite);
    pushIfPositive(TokenMetrics.INPUT_AUDIO, usage.inputDetails.audio);
    pushIfPositive(TokenMetrics.INPUT_IMAGE, usage.inputDetails.image);
  }

  if (usage.outputDetails) {
    pushIfPositive(TokenMetrics.OUTPUT_TEXT, usage.outputDetails.text);
    pushIfPositive(TokenMetrics.OUTPUT_REASONING, usage.outputDetails.reasoning);
    pushIfPositive(TokenMetrics.OUTPUT_AUDIO, usage.outputDetails.audio);
    pushIfPositive(TokenMetrics.OUTPUT_IMAGE, usage.outputDetails.image);
  }

  return samples;
}
