import { LLM } from '../llm';
import { ModelConfig } from '../llm/types';

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

export abstract class MetricWithLLM extends Metric {
  protected llm: LLM;

  constructor(model: ModelConfig) {
    super();
    this.llm = new LLM({ model });
  }
}
