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
} from '@mastra/core/observability';

import { SpanType, InternalSpans } from '@mastra/core/observability';
import { ModelSpanTracker } from '../model-tracing';

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
  public traceState?: TraceState;
  /** Parent span ID (for root spans that are children of external spans) */
  protected parentSpanId?: string;

  constructor(options: CreateSpanOptions<TType>, observabilityInstance: ObservabilityInstance) {
    this.name = options.name;
    this.type = options.type;
    this.attributes = deepClean(options.attributes) || ({} as SpanTypeMap[TType]);
    this.metadata = deepClean(options.metadata);
    this.parent = options.parent;
    this.startTime = new Date();
    this.observabilityInstance = observabilityInstance;
    this.isEvent = options.isEvent ?? false;
    this.isInternal = isSpanInternal(this.type, options.tracingPolicy?.internal);
    this.traceState = options.traceState;

    if (this.isEvent) {
      // Event spans don't have endTime or input.
      // Event spans are immediately emitted by the BaseObservability class via the end() event.
      this.output = deepClean(options.output);
    } else {
      this.input = deepClean(options.input);
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
    };
  }

  get externalTraceId(): string | undefined {
    return this.isValid ? this.traceId : undefined;
  }
}

const DEFAULT_KEYS_TO_STRIP = new Set([
  'logger',
  'experimental_providerMetadata',
  'providerMetadata',
  'steps',
  'tracingContext',
]);
export interface DeepCleanOptions {
  keysToStrip?: Set<string>;
  maxDepth?: number;
}

/**
 * Recursively cleans a value by removing circular references and stripping problematic or sensitive keys.
 * Circular references are replaced with "[Circular]". Unserializable values are replaced with error messages.
 * Keys like "logger" and "tracingContext" are stripped by default.
 * A maximum recursion depth is enforced to avoid stack overflow or excessive memory usage.
 *
 * @param value - The value to clean (object, array, primitive, etc.)
 * @param options - Optional configuration:
 *   - keysToStrip: Set of keys to remove from objects (default: logger, tracingContext)
 *   - maxDepth: Maximum recursion depth before values are replaced with "[MaxDepth]" (default: 10)
 * @returns A cleaned version of the input with circular references, specified keys, and overly deep values handled
 */
export function deepClean(
  value: any,
  options: DeepCleanOptions = {},
  _seen: WeakSet<any> = new WeakSet(),
  _depth: number = 0,
): any {
  const { keysToStrip = DEFAULT_KEYS_TO_STRIP, maxDepth = 10 } = options;

  if (_depth > maxDepth) {
    return '[MaxDepth]';
  }

  if (value === null || typeof value !== 'object') {
    try {
      JSON.stringify(value);
      return value;
    } catch (error) {
      return `[${error instanceof Error ? error.message : String(error)}]`;
    }
  }

  if (_seen.has(value)) {
    return '[Circular]';
  }

  _seen.add(value);

  if (Array.isArray(value)) {
    return value.map(item => deepClean(item, options, _seen, _depth + 1));
  }

  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(value)) {
    if (keysToStrip.has(key)) {
      continue;
    }

    try {
      cleaned[key] = deepClean(val, options, _seen, _depth + 1);
    } catch (error) {
      cleaned[key] = `[${error instanceof Error ? error.message : String(error)}]`;
    }
  }

  return cleaned;
}
