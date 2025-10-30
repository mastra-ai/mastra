/**
 * No Op Implementation for MastraAITracing
 */

import type {
  AITracing,
  AISpanType,
  CreateSpanOptions,
  EndSpanOptions,
  UpdateSpanOptions,
  ErrorSpanOptions,
} from '../types';
import { BaseAISpan } from './base';

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
}
