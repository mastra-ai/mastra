export interface MetricResult {
  score: number;
  info?: Record<string, any>;
}

export abstract class Metric {
  abstract measure(input: string, output: string): Promise<MetricResult>;
}
