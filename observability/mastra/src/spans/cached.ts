/**
 * CachedSpan - A span rebuilt from exported data for lifecycle operations.
 *
 * Used by durable execution engines (e.g., Inngest) to end/update spans
 * that were created in a previous durable operation. This span holds
 * the cached ExportedSpan data and can emit lifecycle events when
 * end(), update(), or error() is called.
 */

import type {
  Span,
  SpanType,
  SpanTypeMap,
  AnySpan,
  ExportedSpan,
  EndSpanOptions,
  ErrorSpanOptions,
  UpdateSpanOptions,
  ChildSpanOptions,
  ChildEventOptions,
  ObservabilityInstance,
  TraceState,
  EntityType,
  AIModelGenerationSpan,
} from '@mastra/core/observability';
import { MastraError } from '@mastra/core/error';
import { deepClean, mergeSerializationOptions } from './serialization';
import type { DeepCleanOptions } from './serialization';

/**
 * A span implementation that is rebuilt from cached/exported data.
 * Used for calling end()/update()/error() on spans that were created
 * in a previous durable operation (e.g., Inngest step.run).
 *
 * Note: This span does NOT emit SPAN_STARTED on creation - it assumes
 * the original span already emitted that event. It only emits
 * SPAN_UPDATED or SPAN_ENDED when those methods are called.
 */
export class CachedSpan<TType extends SpanType = any> implements Span<TType> {
  public readonly id: string;
  public readonly traceId: string;
  public readonly name: string;
  public readonly type: TType;
  public readonly startTime: Date;
  public readonly isEvent: boolean;
  public readonly isInternal: boolean;

  public attributes: SpanTypeMap[TType];
  public metadata?: Record<string, any>;
  public input?: any;
  public output?: any;
  public endTime?: Date;
  public errorInfo?: {
    message: string;
    id?: string;
    domain?: string;
    category?: string;
    details?: Record<string, any>;
  };
  public tags?: string[];
  public traceState?: TraceState;
  public entityType?: EntityType;
  public entityId?: string;
  public entityName?: string;

  // No parent reference - we only have the ID
  public readonly parent?: undefined;
  private readonly parentSpanId?: string;
  public readonly observabilityInstance: ObservabilityInstance;
  private readonly deepCleanOptions: DeepCleanOptions;

  constructor(cached: ExportedSpan<TType>, observabilityInstance: ObservabilityInstance) {
    this.observabilityInstance = observabilityInstance;

    // Get serialization options from observability instance config
    const serializationOptions = observabilityInstance.getConfig().serializationOptions;
    this.deepCleanOptions = mergeSerializationOptions(serializationOptions);

    // Copy all fields from cached data
    this.id = cached.id;
    this.traceId = cached.traceId;
    this.name = cached.name;
    this.type = cached.type;
    this.startTime = new Date(cached.startTime);
    this.isEvent = cached.isEvent;
    this.isInternal = false; // Cached spans are treated as external for export purposes

    this.attributes = (cached.attributes || {}) as SpanTypeMap[TType];
    this.metadata = cached.metadata;
    this.input = cached.input;
    this.output = cached.output;
    this.endTime = cached.endTime ? new Date(cached.endTime) : undefined;
    this.errorInfo = cached.errorInfo;
    this.tags = cached.tags;
    this.parentSpanId = cached.parentSpanId;
    this.entityType = cached.entityType;
    this.entityId = cached.entityId;
    this.entityName = cached.entityName;
  }

  end(options?: EndSpanOptions<TType>): void {
    if (this.isEvent) {
      return;
    }
    this.endTime = new Date();
    if (options?.output !== undefined) {
      this.output = deepClean(options.output, this.deepCleanOptions);
    }
    if (options?.attributes) {
      this.attributes = { ...this.attributes, ...deepClean(options.attributes, this.deepCleanOptions) };
    }
    if (options?.metadata) {
      this.metadata = { ...this.metadata, ...deepClean(options.metadata, this.deepCleanOptions) };
    }
    // Note: SPAN_ENDED event is emitted automatically by wireSpanLifecycle wrapper
  }

  error(options: ErrorSpanOptions<TType>): void {
    if (this.isEvent) {
      return;
    }

    const { error, endSpan = true, attributes, metadata } = options;

    this.errorInfo =
      error instanceof MastraError
        ? {
            id: error.id,
            details: error.details,
            category: error.category,
            domain: error.domain,
            message: error.message,
          }
        : {
            message: error.message,
          };

    if (attributes) {
      this.attributes = { ...this.attributes, ...deepClean(attributes, this.deepCleanOptions) };
    }
    if (metadata) {
      this.metadata = { ...this.metadata, ...deepClean(metadata, this.deepCleanOptions) };
    }

    if (endSpan) {
      this.end();
    }
    // Note: If not ending, SPAN_UPDATED event is emitted by calling update() separately
    // The wireSpanLifecycle wrapper handles this
  }

  update(options: UpdateSpanOptions<TType>): void {
    if (this.isEvent) {
      return;
    }

    if (options.input !== undefined) {
      this.input = deepClean(options.input, this.deepCleanOptions);
    }
    if (options.output !== undefined) {
      this.output = deepClean(options.output, this.deepCleanOptions);
    }
    if (options.attributes) {
      this.attributes = { ...this.attributes, ...deepClean(options.attributes, this.deepCleanOptions) };
    }
    if (options.metadata) {
      this.metadata = { ...this.metadata, ...deepClean(options.metadata, this.deepCleanOptions) };
    }
    // Note: SPAN_UPDATED event is emitted automatically by wireSpanLifecycle wrapper
  }

  /**
   * Create a child span by delegating to the observability instance.
   * This allows CachedSpan to be used as a parent span in control-flow operations.
   */
  createChildSpan(options: ChildSpanOptions<SpanType.MODEL_GENERATION>): AIModelGenerationSpan;
  createChildSpan<TChildType extends SpanType>(options: ChildSpanOptions<TChildType>): Span<TChildType> {
    // Delegate to observability instance with this span as parent
    return this.observabilityInstance.startSpan({
      ...options,
      traceId: this.traceId,
      parentSpanId: this.id,
    }) as Span<TChildType>;
  }

  createEventSpan<TChildType extends SpanType>(options: ChildEventOptions<TChildType>): Span<TChildType> {
    // Delegate to observability instance with this span as parent
    return this.observabilityInstance.startSpan({
      ...options,
      traceId: this.traceId,
      parentSpanId: this.id,
      isEvent: true,
    }) as Span<TChildType>;
  }

  get isRootSpan(): boolean {
    return !this.parentSpanId;
  }

  get isValid(): boolean {
    return true;
  }

  getParentSpanId(_includeInternalSpans?: boolean): string | undefined {
    return this.parentSpanId;
  }

  findParent<T extends SpanType>(_spanType: T): Span<T> | undefined {
    // CachedSpan doesn't have parent references - only IDs
    return undefined;
  }

  exportSpan(_includeInternalSpans?: boolean): ExportedSpan<TType> {
    return {
      id: this.id,
      traceId: this.traceId,
      name: this.name,
      type: this.type,
      entityType: this.entityType,
      entityId: this.entityId,
      entityName: this.entityName,
      attributes: this.attributes,
      metadata: this.metadata,
      startTime: this.startTime,
      endTime: this.endTime,
      input: this.input,
      output: this.output,
      errorInfo: this.errorInfo,
      isEvent: this.isEvent,
      isRootSpan: this.isRootSpan,
      parentSpanId: this.parentSpanId,
      ...(this.isRootSpan && this.tags?.length ? { tags: this.tags } : {}),
    };
  }

  get externalTraceId(): string | undefined {
    return this.traceId;
  }

  async executeInContext<T>(fn: () => Promise<T>): Promise<T> {
    const bridge = this.observabilityInstance.getBridge();
    if (bridge?.executeInContext) {
      return bridge.executeInContext(this.id, fn);
    }
    return fn();
  }

  executeInContextSync<T>(fn: () => T): T {
    const bridge = this.observabilityInstance.getBridge();
    if (bridge?.executeInContextSync) {
      return bridge.executeInContextSync(this.id, fn);
    }
    return fn();
  }
}
