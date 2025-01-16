export interface MeasureParams {
  input: string;
  output: string;
}

export interface MetricResult {
  score: number;
  reason?: string;
}

export abstract class Metric {
  abstract measure(args: MeasureParams): Promise<MetricResult>;
}
