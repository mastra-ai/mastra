/**
 * No Op Implementation for MastraAITracing
 */

import { getAITracing } from '../registry';
import type {
  AITracing,
  AISpanType,
  CreateSpanOptions,
  EndSpanOptions,
  UpdateSpanOptions,
  ErrorSpanOptions,
  AISpan,
  ExportedAISpan,
} from '../types';
import { BaseAISpan, BaseExportedAISpan } from './base';

export class NoOpAISpan<TType extends AISpanType = any> extends BaseAISpan<TType> {
  public id: string;
  public traceId: string;

  constructor(options: CreateSpanOptions<TType>, aiTracing: AITracing) {
    super(options, aiTracing);
    this.id = 'no-op';
    this.traceId = 'no-op-trace';
  }

  end(_options?: EndSpanOptions<TType>): void {}

  error(_options: ErrorSpanOptions<TType>): void {}

  update(_options: UpdateSpanOptions<TType>): void {}

  get isValid(): boolean {
    return false;
  }

  public exportSpan(includeInternalSpans?: boolean): ExportedAISpan<TType> | undefined {
    return new NoOpExportedAISpan(this, includeInternalSpans);
  }
}

export class NoOpExportedAISpan<TType extends AISpanType = any> extends BaseExportedAISpan<TType> {
  public resumeSpan(): AISpan<TType> | undefined {
    const aiTracing = getAITracing(this.configName);
    //TODO: log a warning about the config not existing
    //ISSUE: this will create a child span off the parent... which doesn't exist
    // also we won't be able to recreate the parent span, so this will be treated like a root span?
    return aiTracing ? new NoOpAISpan(this, aiTracing) : undefined;
  }
}