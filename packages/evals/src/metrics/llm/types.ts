import { MetricResult } from '@mastra/core';

export interface MetricResultWithReason extends MetricResult {
  info: {
    reason: string;
  };
}
