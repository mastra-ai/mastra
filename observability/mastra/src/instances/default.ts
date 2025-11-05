import type { SpanType, Span, CreateSpanOptions } from '@mastra/core/observability';
import type { ObservabilityInstanceConfig } from '../config';
import { DefaultSpan } from '../spans';
import { BaseObservabilityInstance } from './base';

export class DefaultObservabilityInstance extends BaseObservabilityInstance {
  constructor(config: ObservabilityInstanceConfig) {
    super(config);
  }

  protected createSpan<TType extends SpanType>(options: CreateSpanOptions<TType>): Span<TType> {
    // Simple span creation - base class handles all tracing lifecycle automatically
    return new DefaultSpan<TType>(options, this);
  }
}
