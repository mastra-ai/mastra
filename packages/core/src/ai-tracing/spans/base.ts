import { deepClean } from '../serialization';
import type {
  AISpan,
  AISpanTypeMap,
  AnyAISpan,
  ChildSpanOptions,
  ChildEventOptions,
  EndSpanOptions,
  ErrorSpanOptions,
  UpdateSpanOptions,
  CreateSpanOptions,
  AITracing,
  ExportedAISpan,
  TraceState,
} from '../types';

import { AISpanType, InternalSpans } from '../types';

/**
 * Determines if a span type should be considered internal based on flags.
 * Returns false if flags are undefined.
 */
function isSpanInternal(spanType: AISpanType, flags?: InternalSpans): boolean {
  if (flags === undefined || flags === InternalSpans.NONE) {
    return false;
  }

  switch (spanType) {
    // Workflow-related spans
    case AISpanType.WORKFLOW_RUN:
    case AISpanType.WORKFLOW_STEP:
    case AISpanType.WORKFLOW_CONDITIONAL:
    case AISpanType.WORKFLOW_CONDITIONAL_EVAL:
    case AISpanType.WORKFLOW_PARALLEL:
    case AISpanType.WORKFLOW_LOOP:
    case AISpanType.WORKFLOW_SLEEP:
    case AISpanType.WORKFLOW_WAIT_EVENT:
      return (flags & InternalSpans.WORKFLOW) !== 0;

    // Agent-related spans
    case AISpanType.AGENT_RUN:
      return (flags & InternalSpans.AGENT) !== 0;

    // Tool-related spans
    case AISpanType.TOOL_CALL:
    case AISpanType.MCP_TOOL_CALL:
      return (flags & InternalSpans.TOOL) !== 0;

    // Model-related spans
    case AISpanType.MODEL_GENERATION:
    case AISpanType.MODEL_STEP:
    case AISpanType.MODEL_CHUNK:
      return (flags & InternalSpans.MODEL) !== 0;

    // Default: never internal
    default:
      return false;
  }
}

export abstract class BaseAISpan<TType extends AISpanType = any> implements AISpan<TType> {
  public abstract id: string;
  public abstract traceId: string;

  public name: string;
  public type: TType;
  public attributes: AISpanTypeMap[TType];
  public parent?: AnyAISpan;
  public startTime: Date;
  public endTime?: Date;
  public isEvent: boolean;
  public isInternal: boolean;
  public aiTracing: AITracing;
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

  constructor(options: CreateSpanOptions<TType>, aiTracing: AITracing) {
    this.name = options.name;
    this.type = options.type;
    this.attributes = deepClean(options.attributes) || ({} as AISpanTypeMap[TType]);
    this.metadata = deepClean(options.metadata);
    this.parent = options.parent;
    this.startTime = new Date();
    this.aiTracing = aiTracing;
    this.isEvent = options.isEvent ?? false;
    this.isInternal = isSpanInternal(this.type, options.tracingPolicy?.internal);
    this.traceState = options.traceState;

    if (this.isEvent) {
      // Event spans don't have endTime or input.
      // Event spans are immediately emitted by the BaseAITracing class via the end() event.
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

  createChildSpan<TChildType extends AISpanType>(options: ChildSpanOptions<TChildType>): AISpan<TChildType> {
    return this.aiTracing.startSpan<TChildType>({ ...options, parent: this, isEvent: false });
  }

  createEventSpan<TChildType extends AISpanType>(options: ChildEventOptions<TChildType>): AISpan<TChildType> {
    return this.aiTracing.startSpan<TChildType>({ ...options, parent: this, isEvent: true });
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
  public findParent<T extends AISpanType>(spanType: T): AISpan<T> | undefined {
    let current: AnyAISpan | undefined = this.parent;

    while (current) {
      if (current.type === spanType) {
        return current as AISpan<T>;
      }
      current = current.parent;
    }

    return undefined;
  }

  /** Returns a lightweight span ready for export */
  public exportSpan(includeInternalSpans?: boolean): ExportedAISpan<TType> {
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
}
