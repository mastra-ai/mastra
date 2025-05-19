import type { MetricResult } from './metric';

export interface TestInfo {
  testName?: string;
  testPath?: string;
  agentVersion: string;
}

export interface EvaluationResult extends MetricResult {
  output: string;
}
