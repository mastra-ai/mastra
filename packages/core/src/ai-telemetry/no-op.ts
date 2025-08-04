/**
 * No Op Implementation for MastraAITelemetry
 */

import type { MastraAITelemetry } from './base';
import type { AISpanType, AISpan, AISpanOptions, AISpanTypeMap } from './types';

export class NoOpAISpan<TType extends AISpanType = any> implements AISpan<TType> {
  public id: string;
  public name: string;
  public type: TType;
  public metadata: AISpanTypeMap[TType];
  public trace: AISpan<any>;
  public traceId: string;
  public startTime: Date;
  public endTime?: Date;
  public aiTelemetry: MastraAITelemetry;

  constructor(options: AISpanOptions<TType>, aiTelemetry: MastraAITelemetry) {
    this.id = 'no-op';
    this.name = options.name;
    this.type = options.type;
    this.metadata = options.metadata;
    this.trace = options.parent ? options.parent.trace : (this as any);
    this.traceId = options.parent ? options.parent.trace.traceId : 'no-op-trace';
    this.startTime = new Date();
    this.aiTelemetry = aiTelemetry;
  }

  end(): void {}
  error(): void {}
  createChildSpan<TChildType extends AISpanType>(
    type: TChildType,
    name: string,
    metadata: AISpanTypeMap[TChildType],
  ): AISpan<TChildType> {
    return new NoOpAISpan<TChildType>({ type, name, metadata, parent: this }, this.aiTelemetry);
  }
  update(): void {}
}
