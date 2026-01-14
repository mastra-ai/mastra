import type {
  Span,
  SpanTypeMap,
  AnySpan,
  ChildSpanOptions,
  ChildEventOptions,
  EndSpanOptions,
  ErrorSpanOptions,
  UpdateSpanOptions,
  CreateSpanOptions,
  ObservabilityInstance,
  ExportedSpan,
  TraceState,
  IModelSpanTracker,
  AIModelGenerationSpan,
  EntityType,
} from '@mastra/core/observability';

import { SpanType, InternalSpans } from '@mastra/core/observability';
import { ModelSpanTracker } from '../model-tracing';
import { deepClean, mergeSerializationOptions } from './serialization';
import type { DeepCleanOptions } from './serialization';

/**
 * Determines if a span type should be considered internal based on flags.
 * Returns false if flags are undefined.
 */
function isSpanInternal(spanType: SpanType, flags?: InternalSpans): boolean {
  if (flags === undefined || flags === InternalSpans.NONE) {
    return false;
  }

  switch (spanType) {
    // Workflow-related spans
    case SpanType.WORKFLOW_RUN:
    case SpanType.WORKFLOW_STEP:
    case SpanType.WORKFLOW_CONDITIONAL:
    case SpanType.WORKFLOW_CONDITIONAL_EVAL:
    case SpanType.WORKFLOW_PARALLEL:
    case SpanType.WORKFLOW_LOOP:
    case SpanType.WORKFLOW_SLEEP:
    case SpanType.WORKFLOW_WAIT_EVENT:
      return (flags & InternalSpans.WORKFLOW) !== 0;

    // Agent-related spans
    case SpanType.AGENT_RUN:
      return (flags & InternalSpans.AGENT) !== 0;

    // Tool-related spans
    case SpanType.TOOL_CALL:
    case SpanType.MCP_TOOL_CALL:
      return (flags & InternalSpans.TOOL) !== 0;

    // Model-related spans
    case SpanType.MODEL_GENERATION:
    case SpanType.MODEL_STEP:
    case SpanType.MODEL_CHUNK:
      return (flags & InternalSpans.MODEL) !== 0;

    // Default: never internal
    default:
      return false;
  }
}

/**
 * Get the external parent span ID from CreateSpanOptions.
 *
 * If the parent is internal, walks up the parent chain to find
 * the closest external ancestor. If the parent is already external,
 * returns its ID directly.
 *
 * This is useful when exporting spans to external observability systems
 * that shouldn't include internal framework spans.
 *
 * @param options - Span creation options
 * @returns The external parent span ID, or undefined if no external parent exists
 *
 * @example
 * ```typescript
 * // Parent is external - returns parent.id
 * const externalParent = { id: 'span-123', isInternal: false };
 * const options = { parent: externalParent, ... };
 * getExternalParentId(options); // 'span-123'
 *
 * // Parent is internal - walks up to find external ancestor
 * const externalGrandparent = { id: 'span-456', isInternal: false };
 * const internalParent = { id: 'span-123', isInternal: true, parent: externalGrandparent };
 * const options = { parent: internalParent, ... };
 * getExternalParentId(options); // 'span-456'
 * ```
 */
export function getExternalParentId(options: CreateSpanOptions<any>): string | undefined {
  if (!options.parent) {
    return undefined;
  }

  if (options.parent.isInternal) {
    // Parent is internal, find its external ancestor
    return options.parent.getParentSpanId(false);
  } else {
    // Parent is already external, use it directly
    return options.parent.id;
  }
}

export abstract class BaseSpan<TType extends SpanType = any> implements Span<TType> {
  public abstract id: string;
  public abstract traceId: string;

  public name: string;
  public type: TType;
  public attributes: SpanTypeMap[TType];
  public parent?: AnySpan;
  public startTime: Date;
  public endTime?: Date;
  public isEvent: boolean;
  public isInternal: boolean;
  public observabilityInstance: ObservabilityInstance;
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
  public tags?: string[];
  public traceState?: TraceState;
  /** Entity type that created the span (e.g., agent, workflow) */
  public entityType?: EntityType;
  /** Entity ID that created the span */
  public entityId?: string;
  /** Entity name that created the span */
  public entityName?: string;
  /** Parent span ID (for root spans that are children of external spans) */
  protected parentSpanId?: string;
  /** Deep clean options for serialization */
  protected deepCleanOptions: DeepCleanOptions;

  constructor(options: CreateSpanOptions<TType>, observabilityInstance: ObservabilityInstance) {
    // Get serialization options from observability instance config
    const serializationOptions = observabilityInstance.getConfig().serializationOptions;
    this.deepCleanOptions = mergeSerializationOptions(serializationOptions);

    this.name = options.name;
    this.type = options.type;
    this.attributes = deepClean(options.attributes, this.deepCleanOptions) || ({} as SpanTypeMap[TType]);
    this.metadata = deepClean(options.metadata, this.deepCleanOptions);
    this.parent = options.parent;
    this.startTime = new Date();
    this.observabilityInstance = observabilityInstance;
    this.isEvent = options.isEvent ?? false;
    this.isInternal = isSpanInternal(this.type, options.tracingPolicy?.internal);
    this.traceState = options.traceState;
    // Tags are only set for root spans (spans without a parent)
    this.tags = !options.parent && options.tags?.length ? options.tags : undefined;
    // Entity identification - inherit from parent if not explicitly provided
    this.entityType = options.entityType ?? options.parent?.entityType;
    this.entityId = options.entityId ?? options.parent?.entityId;
    this.entityName = options.entityName ?? options.parent?.entityName;

    if (this.isEvent) {
      // Event spans don't have endTime or input.
      // Event spans are immediately emitted by the BaseObservability class via the end() event.
      this.output = deepClean(options.output, this.deepCleanOptions);
    } else {
      this.input = deepClean(options.input, this.deepCleanOptions);
    }
  }

  // Methods for span lifecycle
  /** End the span */
  abstract end(options?: EndSpanOptions<TType>): void;

  /** Record an error for the span, optionally end the span as well */
  abstract error(options: ErrorSpanOptions<TType>): void;

  /** Update span attributes */
  abstract update(options: UpdateSpanOptions<TType>): void;

  createChildSpan(options: ChildSpanOptions<SpanType.MODEL_GENERATION>): AIModelGenerationSpan;
  createChildSpan<TChildType extends SpanType>(options: ChildSpanOptions<TChildType>): Span<TChildType> {
    return this.observabilityInstance.startSpan<TChildType>({ ...options, parent: this, isEvent: false });
  }

  createEventSpan<TChildType extends SpanType>(options: ChildEventOptions<TChildType>): Span<TChildType> {
    return this.observabilityInstance.startSpan<TChildType>({ ...options, parent: this, isEvent: true });
  }

  /**
   * Create a ModelSpanTracker for this span (only works if this is a MODEL_GENERATION span)
   * Returns undefined for non-MODEL_GENERATION spans
   */
  createTracker(): IModelSpanTracker | undefined {
    // Only create tracker for MODEL_GENERATION spans
    if (this.type !== SpanType.MODEL_GENERATION) {
      return undefined;
    }

    return new ModelSpanTracker(this as Span<SpanType.MODEL_GENERATION>);
  }

  /** Returns `TRUE` if the span is the root span of a trace */
  get isRootSpan(): boolean {
    return !this.parent;
  }

  /** Returns `TRUE` if the span is a valid span (not a NO-OP Span) */
  abstract get isValid(): boolean;

  /** Get the closest parent spanId that isn't an internal span */
  public getParentSpanId(includeInternalSpans?: boolean): string | undefined {
    if (!this.parent) {
      // Return parent span ID if available, otherwise undefined
      return this.parentSpanId;
    }
    if (includeInternalSpans) return this.parent.id;
    if (this.parent.isInternal) return this.parent.getParentSpanId(includeInternalSpans);

    return this.parent.id;
  }

  /** Find the closest parent span of a specific type by walking up the parent chain */
  public findParent<T extends SpanType>(spanType: T): Span<T> | undefined {
    let current: AnySpan | undefined = this.parent;

    while (current) {
      if (current.type === spanType) {
        return current as Span<T>;
      }
      current = current.parent;
    }

    return undefined;
  }

  /** Returns a lightweight span ready for export */
  public exportSpan(includeInternalSpans?: boolean): ExportedSpan<TType> {
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
      parentSpanId: this.getParentSpanId(includeInternalSpans),
      // Tags are only included for root spans
      ...(this.isRootSpan && this.tags?.length ? { tags: this.tags } : {}),
    };
  }

  get externalTraceId(): string | undefined {
    return this.isValid ? this.traceId : undefined;
  }

  /**
   * Execute an async function within this span's tracing context.
   * Delegates to the bridge if available.
   */
  async executeInContext<T>(fn: () => Promise<T>): Promise<T> {
    const bridge = this.observabilityInstance.getBridge();

    if (bridge?.executeInContext) {
      return bridge.executeInContext(this.id, fn);
    }

    return fn();
  }

  /**
   * Execute a synchronous function within this span's tracing context.
   * Delegates to the bridge if available.
   */
  executeInContextSync<T>(fn: () => T): T {
    const bridge = this.observabilityInstance.getBridge();

    if (bridge?.executeInContextSync) {
      return bridge.executeInContextSync(this.id, fn);
    }

    return fn();
  }
}
