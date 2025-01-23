export interface MeasureParams {
  input: string;
  output: string;
}

export interface MetricResult {
  score: number;
  info?: Record<string, any>;
}

export abstract class Metric {
  abstract measure(args: MeasureParams): Promise<MetricResult>;
}
