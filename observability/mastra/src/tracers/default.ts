import type { AISpanType, AISpan, TracingConfig, CreateSpanOptions } from '@mastra/core/observability';
import { DefaultAISpan } from '../spans';
import { BaseAITracing } from './base';

export class DefaultAITracing extends BaseAITracing {
  constructor(config: TracingConfig) {
    super(config);
  }

  protected createSpan<TType extends AISpanType>(options: CreateSpanOptions<TType>): AISpan<TType> {
    // Simple span creation - base class handles all tracing lifecycle automatically
    return new DefaultAISpan<TType>(options, this);
  }
}
