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

    // LLM-related spans
    case AISpanType.LLM_GENERATION:
    case AISpanType.LLM_CHUNK:
      return (flags & InternalSpans.LLM) !== 0;

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
    if (!this.parent) return undefined; // no parent at all
    if (includeInternalSpans) return this.parent.id;
    if (this.parent.isInternal) return this.parent.getParentSpanId(includeInternalSpans);

    return this.parent.id;
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
