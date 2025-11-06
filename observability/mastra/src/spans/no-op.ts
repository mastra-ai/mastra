/**
 * NoOpSpan Implementation for Mastra Observability
 */

import type {
  ObservabilityInstance,
  SpanType,
  CreateSpanOptions,
  EndSpanOptions,
  UpdateSpanOptions,
  ErrorSpanOptions,
} from '@mastra/core/observability';
import { BaseSpan } from './base';

export class NoOpSpan<TType extends SpanType = any> extends BaseSpan<TType> {
  public id: string;
  public traceId: string;

  constructor(options: CreateSpanOptions<TType>, observabilityInstance: ObservabilityInstance) {
    super(options, observabilityInstance);
    this.id = 'no-op';
    this.traceId = 'no-op-trace';
  }

  end(_options?: EndSpanOptions<TType>): void {}

  error(_options: ErrorSpanOptions<TType>): void {}

  update(_options: UpdateSpanOptions<TType>): void {}

  get isValid(): boolean {
    return false;
  }
}
