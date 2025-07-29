/**
 * No Op Implementation for MastraAITelemetry
 */

import type { MastraAITelemetry } from './base';
import { type AISpan, type AISpanOptions, type AISpanMetadata, AISpanType } from './types';

export class NoOpAISpan implements AISpan {
  public id: string;
  public name: string;
  public type: AISpanType;
  public metadata: AISpanMetadata;
  public children: AISpan<AISpanMetadata>[] = [];
  public parent?: AISpan<AISpanMetadata>;
  public trace: AISpan<AISpanMetadata>;
  public startTime: Date;
  public endTime?: Date;
  public aiTelemetry: MastraAITelemetry;

  constructor(options: AISpanOptions, aiTelemetry: MastraAITelemetry) {
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
