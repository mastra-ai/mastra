import { MetricResult } from '@mastra/core';

export interface MetricScoringResult extends MetricResult {
  score: number; // 0-1 normalized score
  info: {
    weight?: number;
    responseSentiment: number;
    referenceSentiment: number;
    difference: number;
  };
}

export interface MetricOptions {
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
  // Add more options as needed
}
