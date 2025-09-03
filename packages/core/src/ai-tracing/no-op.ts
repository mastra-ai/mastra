/**
 * No Op Implementation for MastraAITracing
 */

import type { MastraAITracing } from './base';
import type { AISpanType, AISpan, AISpanOptions, AISpanTypeMap, AnyAISpan } from './types';

export class NoOpAISpan<TType extends AISpanType = any> implements AISpan<TType> {
  public id: string;
  public name: string;
  public type: TType;
  public attributes: AISpanTypeMap[TType];
  public parent?: AnyAISpan;
  public traceId: string;
  public startTime: Date;
  public endTime?: Date;
  public isEvent: boolean;
  public aiTracing: MastraAITracing;
  public input?: any;
  public output?: any;
  public errorInfo?: {
    message: string;
    id?: string;
    domain?: string;
    category?: string;
    details?: Record<string, any>;
  };
  public metadata?: Record<string, any>;

  constructor(options: AISpanOptions<TType>, aiTracing: MastraAITracing) {
    this.id = 'no-op';
    this.name = options.name;
    this.type = options.type;
    this.attributes = options.attributes || ({} as AISpanTypeMap[TType]);
    this.metadata = options.metadata;
    this.parent = options.parent;
    this.traceId = 'no-op-trace';
    this.startTime = new Date();
    this.aiTracing = aiTracing;
    this.input = options.input;
    this.output = options.isEvent ? options.output : undefined;
    this.isEvent = options.isEvent;
  }

  end(_options?: { output?: any; attributes?: Partial<AISpanTypeMap[TType]>; metadata?: Record<string, any> }): void {}

  error(_options: {
    error: any;
    endSpan?: boolean;
    attributes?: Partial<AISpanTypeMap[TType]>;
    metadata?: Record<string, any>;
  }): void {}

  createChildSpan<TChildType extends AISpanType>(options: {
    type: TChildType;
    name: string;
    input?: any;
    attributes?: AISpanTypeMap[TChildType];
    metadata?: Record<string, any>;
  }): AISpan<TChildType> {
    return new NoOpAISpan<TChildType>({ ...options, parent: this, isEvent: false }, this.aiTracing);
  }

  createEventSpan<TChildType extends AISpanType>(options: {
    type: TChildType;
    name: string;
    output?: any;
    attributes?: AISpanTypeMap[TChildType];
    metadata?: Record<string, any>;
  }): AISpan<TChildType> {
    return new NoOpAISpan<TChildType>({ ...options, parent: this, isEvent: true }, this.aiTracing);
  }

  update(_options?: {
    input?: any;
    output?: any;
    attributes?: Partial<AISpanTypeMap[TType]>;
    metadata?: Record<string, any>;
  }): void {}

  get isRootSpan(): boolean {
    return !this.parent;
  }
}
