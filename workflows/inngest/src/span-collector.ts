/**
 * SpanCollector - Collects span metadata during Inngest workflow execution.
 *
 * Due to Inngest's durable execution model where step.run() memoizes results and
 * replays on each invocation, creating real spans during execution causes duplication.
 * This collector captures span metadata without creating actual spans, allowing us to
 * create proper hierarchical spans in the finalize step.
 *
 * Key insight: Span identity (IDs, timestamps) must be separate from span objects.
 * We collect the data during execution and create real spans with proper parent-child
 * relationships at the end.
 */
import type {
  SpanType,
  EntityType,
  SpanTypeMap,
  EndSpanOptions,
  ErrorSpanOptions,
  UpdateSpanOptions,
  ChildSpanOptions,
  ChildEventOptions,
  Span,
  AnySpan,
  TracingContext,
} from '@mastra/core/observability';

/**
 * Data collected for a span during execution.
 * This is stored and used to create real spans in finalize.
 */
export interface CollectedSpanData {
  /** Unique span identifier */
  id: string;
  /** Span name */
  name: string;
  /** Span type (workflow_step, workflow_conditional, etc.) */
  type: SpanType;
  /** Entity type */
  entityType?: EntityType;
  /** Entity ID */
  entityId?: string;
  /** Entity name */
  entityName?: string;
  /** Input data */
  input?: unknown;
  /** Output data (set on end) */
  output?: unknown;
  /** Error info (set on error) */
  error?: Error;
  /** Span attributes */
  attributes?: Record<string, any>;
  /** Span metadata */
  metadata?: Record<string, any>;
  /** When span started (ms since epoch) */
  startTime: number;
  /** When span ended (ms since epoch) */
  endTime?: number;
  /** Span status */
  status: 'running' | 'success' | 'error';
  /** Child spans */
  children: CollectedSpanData[];
  /** Is this an event span (no end time)? */
  isEvent?: boolean;
}

/**
 * CollectorSpan - A span-like object that collects data instead of exporting.
 *
 * This implements the minimal Span interface needed by workflow handlers,
 * capturing all the span lifecycle events (start, update, end, error)
 * for later reconstruction as real spans.
 */
export class CollectorSpan {
  readonly id: string;
  readonly traceId: string;
  private data: CollectedSpanData;
  private collector: SpanCollector;

  constructor(traceId: string, spanId: string, data: CollectedSpanData, collector: SpanCollector) {
    this.id = spanId;
    this.traceId = traceId;
    this.data = data;
    this.collector = collector;
  }

  /**
   * Get the collected span data
   */
  getData(): CollectedSpanData {
    return this.data;
  }

  /**
   * End the span with optional output and attributes
   */
  end(options?: EndSpanOptions<SpanType>): void {
    this.data.endTime = Date.now();
    this.data.status = 'success';
    if (options?.output !== undefined) {
      this.data.output = options.output;
    }
    if (options?.attributes) {
      this.data.attributes = { ...this.data.attributes, ...options.attributes };
    }
    if (options?.metadata) {
      this.data.metadata = { ...this.data.metadata, ...options.metadata };
    }
  }

  /**
   * Record an error for the span
   */
  error(options: ErrorSpanOptions<SpanType>): void {
    this.data.endTime = Date.now();
    this.data.status = 'error';
    this.data.error = options.error;
    if (options?.attributes) {
      this.data.attributes = { ...this.data.attributes, ...options.attributes };
    }
    if (options?.metadata) {
      this.data.metadata = { ...this.data.metadata, ...options.metadata };
    }
    if (options?.endSpan !== false) {
      // Default is to end the span when error is recorded
    }
  }

  /**
   * Update span attributes
   */
  update(options: UpdateSpanOptions<SpanType>): void {
    if (options?.input !== undefined) {
      this.data.input = options.input;
    }
    if (options?.output !== undefined) {
      this.data.output = options.output;
    }
    if (options?.attributes) {
      this.data.attributes = { ...this.data.attributes, ...options.attributes };
    }
    if (options?.metadata) {
      this.data.metadata = { ...this.data.metadata, ...options.metadata };
    }
  }

  /**
   * Create a child span
   */
  createChildSpan<TChildType extends SpanType>(options: ChildSpanOptions<TChildType>): CollectorSpan {
    return this.collector.createChildSpan(this.data, options);
  }

  /**
   * Create an event span (no end time)
   */
  createEventSpan<TChildType extends SpanType>(options: ChildEventOptions<TChildType>): CollectorSpan {
    const childSpan = this.collector.createChildSpan(this.data, {
      ...options,
      input: options.output, // Events have output, not input
    });
    childSpan.getData().isEvent = true;
    childSpan.getData().output = options.output;
    childSpan.getData().status = 'success';
    return childSpan;
  }

  /**
   * Create a tracker for model generation spans.
   * Returns undefined since we're in collection mode - actual tracking
   * happens when real spans are created in finalize.
   */
  createTracker(): undefined {
    return undefined;
  }

  // Stub methods to match Span interface (not used in collection phase)
  get isRootSpan(): boolean {
    return false;
  }

  get isValid(): boolean {
    return true;
  }

  getParentSpanId(_includeInternalSpans?: boolean): string | undefined {
    return undefined;
  }

  findParent<T extends SpanType>(_spanType: T): Span<T> | undefined {
    return undefined;
  }

  exportSpan(_includeInternalSpans?: boolean): undefined {
    return undefined;
  }

  get externalTraceId(): string | undefined {
    return this.traceId;
  }

  async executeInContext<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  executeInContextSync<T>(fn: () => T): T {
    return fn();
  }
}

/**
 * SpanCollector - Collects span data during workflow execution.
 *
 * Usage:
 * 1. Create a SpanCollector at the start of workflow execution
 * 2. Use collector.createRootSpan() to get the proxy workflow span
 * 3. Steps create child spans via collector which records metadata
 * 4. In finalize, call collector.getCollectedData() to get all span data
 * 5. Create real spans from the collected data with proper hierarchy
 */
export class SpanCollector {
  private traceId: string;
  private rootSpans: CollectedSpanData[] = [];
  private spanIdCounter: number = 0;

  constructor(traceId: string) {
    this.traceId = traceId;
  }

  /**
   * Generate a unique span ID within this trace
   */
  private generateSpanId(): string {
    this.spanIdCounter++;
    // Generate a 16-char hex string similar to real span IDs
    const base = this.spanIdCounter.toString(16).padStart(8, '0');
    const random = Math.random().toString(16).slice(2, 10);
    return (base + random).slice(0, 16);
  }

  /**
   * Create a root span (for the workflow itself)
   */
  createRootSpan<TType extends SpanType>(options: {
    name: string;
    type: TType;
    entityType?: EntityType;
    entityId?: string;
    entityName?: string;
    input?: unknown;
    attributes?: SpanTypeMap[TType];
    metadata?: Record<string, any>;
  }): CollectorSpan {
    const spanId = this.generateSpanId();
    const data: CollectedSpanData = {
      id: spanId,
      name: options.name,
      type: options.type,
      entityType: options.entityType,
      entityId: options.entityId,
      entityName: options.entityName,
      input: options.input,
      attributes: options.attributes,
      metadata: options.metadata,
      startTime: Date.now(),
      status: 'running',
      children: [],
    };

    this.rootSpans.push(data);
    return new CollectorSpan(this.traceId, spanId, data, this);
  }

  /**
   * Create a child span under a parent
   */
  createChildSpan<TType extends SpanType>(parent: CollectedSpanData, options: ChildSpanOptions<TType>): CollectorSpan {
    const spanId = this.generateSpanId();
    const data: CollectedSpanData = {
      id: spanId,
      name: options.name,
      type: options.type,
      entityType: options.entityType,
      entityId: options.entityId,
      entityName: options.entityName,
      input: options.input,
      attributes: options.attributes,
      metadata: options.metadata,
      startTime: Date.now(),
      status: 'running',
      children: [],
    };

    parent.children.push(data);
    return new CollectorSpan(this.traceId, spanId, data, this);
  }

  /**
   * Get all collected span data for creating real spans
   */
  getCollectedData(): CollectedSpanData[] {
    return this.rootSpans;
  }

  /**
   * Get the trace ID
   */
  getTraceId(): string {
    return this.traceId;
  }

  /**
   * Create a TracingContext that uses this collector for span creation.
   * This allows the collector to intercept createChildSpan calls.
   */
  createTracingContext(rootSpan: CollectorSpan): TracingContext {
    return {
      currentSpan: rootSpan as unknown as AnySpan,
    };
  }
}
