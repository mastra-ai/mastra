/**
 * NoOp Implementation for MastraAITelemetry
 */

import type { MastraAITelemetry } from './base';
import { type AISpan, type SpanOptions, type SpanMetadata, SpanType } from './types';

export class NoOpAISpan implements AISpan {
  public id: string;
  public name: string;
  public type: SpanType;
  public metadata: SpanMetadata;
  public children: AISpan<SpanMetadata>[] = [];
  public parent?: AISpan<SpanMetadata>;
  public trace: AISpan<SpanMetadata>;
  public startTime: Date;
  public endTime?: Date;
  public aiTelemetry: MastraAITelemetry;

  constructor(options: SpanOptions, aiTelemetry: MastraAITelemetry) {
    this.id = 'no-op';
    this.name = options.name;
    this.type = options.type;
    this.metadata = options.metadata;
    this.parent = options.parent;
    this.trace = options.parent ? options.parent.trace : this;
    this.startTime = new Date();
    this.aiTelemetry = aiTelemetry;
  }

  end(): void {}
  error(): void {}
  createChildSpan(): AISpan {
    return this;
  }
  update(): void {}
  async export(): Promise<string> {
    return '';
  }
}
