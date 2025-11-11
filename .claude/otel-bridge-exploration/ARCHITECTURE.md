# Mastra Observability Architecture - Deep Dive

## Executive Summary

The Mastra observability system is a sophisticated, event-driven tracing architecture that:

- Creates OpenTelemetry-compatible spans with automatic trace ID propagation
- Supports hierarchical span relationships (parent-child chains)
- Provides event-based span lifecycle management (started, updated, ended)
- Allows flexible context propagation through RequestContext
- Routes span data to exporters and processors through a plugin system

## 1. ObservabilityInstance Implementation

### Location

- **Base Class**: `/Users/epinzur/src/github.com/mastra/mastra/observability/mastra/src/instances/base.ts` (BaseObservabilityInstance)
- **Default Implementation**: `/Users/epinzur/src/github.com/mastra/mastra/observability/mastra/src/instances/default.ts` (DefaultObservabilityInstance)
- **Type Definition**: `/Users/epinzur/src/github.com/mastra/mastra/packages/core/src/observability/types/tracing.ts` (lines 438-473)

### Core Method: `startSpan()`

**Location**: `base.ts` lines 96-134

```typescript
startSpan<TType extends SpanType>(options: StartSpanOptions<TType>): Span<TType> {
  const { customSamplerOptions, requestContext, metadata, tracingOptions, ...rest } = options;

  if (!this.shouldSample(customSamplerOptions)) {
    return new NoOpSpan<TType>({ ...rest, metadata }, this);
  }

  // Compute or inherit TraceState
  let traceState: TraceState | undefined;

  if (options.parent) {
    // Child span: inherit from parent
    traceState = options.parent.traceState;
  } else {
    // Root span: compute new TraceState
    traceState = this.computeTraceState(tracingOptions);
  }

  // Extract metadata from RequestContext
  const enrichedMetadata = this.extractMetadataFromRequestContext(requestContext, metadata, traceState);

  const span = this.createSpan<TType>({
    ...rest,
    metadata: enrichedMetadata,
    traceState,
  });

  if (span.isEvent) {
    this.emitSpanEnded(span);
  } else {
    // Automatically wire up tracing lifecycle
    this.wireSpanLifecycle(span);

    // Emit span started event
    this.emitSpanStarted(span);
  }

  return span;
}
```

### Key Characteristics

1. **Sampling Decision**: Early check at lines 99-101 returns a NoOpSpan if sampling fails
2. **TraceState Inheritance**: Child spans inherit parent's TraceState; root spans compute new one (lines 103-112)
3. **RequestContext Extraction**: Metadata extracted from RequestContext based on TraceState's requestContextKeys (lines 114-115)
4. **Span Lifecycle Wiring**: Non-event spans automatically have their lifecycle methods wrapped to emit events (lines 127-130)
5. **Event Emission**: Immediate emission for event spans; deferred for regular spans

## 2. getOrCreateSpan() Function

### Location

`/Users/epinzur/src/github.com/mastra/mastra/packages/core/src/observability/utils.ts` (lines 12-47)

### Implementation

```typescript
export function getOrCreateSpan<T extends SpanType>(options: GetOrCreateSpanOptions<T>): Span<T> | undefined {
  const { type, attributes, tracingContext, requestContext, tracingOptions, ...rest } = options;

  const metadata = {
    ...(rest.metadata ?? {}),
    ...(tracingOptions?.metadata ?? {}),
  };

  // If we have a current span, create a child span
  if (tracingContext?.currentSpan) {
    return tracingContext.currentSpan.createChildSpan({
      type,
      attributes,
      ...rest,
      metadata,
    });
  }

  // Otherwise, try to create a new root span
  const instance = options.mastra?.observability?.getSelectedInstance({ requestContext });

  return instance?.startSpan<T>({
    type,
    attributes,
    ...rest,
    metadata,
    requestContext,
    tracingOptions,
    traceId: tracingOptions?.traceId,
    parentSpanId: tracingOptions?.parentSpanId,
    customSamplerOptions: {
      requestContext,
      metadata,
    },
  });
}
```

### Critical Function: Bridge Injection Point

**THIS IS WHERE AN OTEL BRIDGE NEEDS TO INJECT CONTEXT**

The function accepts:

- `tracingContext`: Current tracing context (may contain a parent span)
- `tracingOptions`: User-provided tracing configuration including `traceId` and `parentSpanId`
- `requestContext`: Request-scoped context that may contain W3C trace context headers

**Bridge Integration Strategy**: Modify this function to:

1. Extract W3C Trace Context from requestContext if not already provided
2. Inject extracted traceId/parentSpanId into tracingOptions before passing to startSpan

## 3. Span Lifecycle and TraceId Inheritance

### Location

- **BaseSpan**: `/Users/epinzur/src/github.com/mastra/mastra/observability/mastra/src/spans/base.ts` (lines 63-200)
- **DefaultSpan**: `/Users/epinzur/src/github.com/mastra/mastra/observability/mastra/src/spans/default.ts` (lines 1-187)

### TraceId Assignment Logic (DefaultSpan, lines 16-49)

```typescript
constructor(options: CreateSpanOptions<TType>, observabilityInstance: ObservabilityInstance) {
  super(options, observabilityInstance);
  this.id = generateSpanId();

  // Set trace ID based on context:
  if (options.parent) {
    // Child span inherits trace ID from parent span
    this.traceId = options.parent.traceId;
  } else if (options.traceId) {
    // Root span with provided trace ID
    if (isValidTraceId(options.traceId)) {
      this.traceId = options.traceId;
    } else {
      console.error(
        `[Mastra Tracing] Invalid traceId: must be 1-32 hexadecimal characters, got "${options.traceId}". Generating new trace ID.`,
      );
      this.traceId = generateTraceId();
    }
  } else {
    // Root span without provided trace ID - generate new
    this.traceId = generateTraceId();
  }

  // Set parent span ID if provided
  if (!options.parent && options.parentSpanId) {
    if (isValidSpanId(options.parentSpanId)) {
      this.parentSpanId = options.parentSpanId;
    } else {
      console.error(
        `[Mastra Tracing] Invalid parentSpanId: must be 1-16 hexadecimal characters, got "${options.parentSpanId}". Ignoring parent span ID.`,
      );
    }
  }
}
```

### Parent Chain Mechanism

1. **Direct Parent Reference**: Each span stores `parent?: AnySpan` (BaseSpan line 70)
2. **Walking the Chain**: BaseSpan.getParentSpanId() (lines 152-161) walks up parent chain to find nearest non-internal span
3. **Parent Inheritance**: When exporting, parent span ID is calculated via `getParentSpanId()` (BaseSpan line 193)
4. **Root Detection**: `isRootSpan` property checks if `!this.parent` (BaseSpan lines 143-146)

### Span ID Generation (OpenTelemetry Compatible)

**generateTraceId()** (lines 160-172):

- Generates 16 random bytes (128 bits) = 32 hex characters
- Uses `crypto.getRandomValues()` if available, otherwise Math.random fallback
- Format: `[0-9a-f]{32}`

**generateSpanId()** (lines 143-155):

- Generates 8 random bytes (64 bits) = 16 hex characters
- Same crypto approach
- Format: `[0-9a-f]{16}`

## 4. Exporter System

### Location

- **Base Class**: `/Users/epinzur/src/github.com/mastra/mastra/observability/mastra/src/exporters/base.ts`
- **Default Exporter**: `/Users/epinzur/src/github.com/mastra/mastra/observability/mastra/src/exporters/default.ts`
- **Type Definition**: `/Users/epinzur/src/github.com/mastra/mastra/packages/core/src/observability/types/tracing.ts` (lines 778-840)

### Event Types

**TracingEventType** (types/tracing.ts lines 781-785):

```typescript
export enum TracingEventType {
  SPAN_STARTED = 'span_started',
  SPAN_UPDATED = 'span_updated',
  SPAN_ENDED = 'span_ended',
}
```

### Event Data Structure

**TracingEvent** (types/tracing.ts lines 790-793):

```typescript
export type TracingEvent =
  | { type: TracingEventType.SPAN_STARTED; exportedSpan: AnyExportedSpan }
  | { type: TracingEventType.SPAN_UPDATED; exportedSpan: AnyExportedSpan }
  | { type: TracingEventType.SPAN_ENDED; exportedSpan: AnyExportedSpan };
```

### Exporter Interface

**ObservabilityExporter** (types/tracing.ts lines 809-840):

```typescript
export interface ObservabilityExporter {
  /** Exporter name */
  name: string;

  /** Initialize exporter with tracing configuration and/or access to Mastra */
  init?(options: InitExporterOptions): void;

  /** Sets logger instance on the exporter. */
  __setLogger?(logger: IMastraLogger): void;

  /** Export tracing events */
  exportTracingEvent(event: TracingEvent): Promise<void>;

  addScoreToTrace?(...): Promise<void>;

  /** Shutdown exporter */
  shutdown(): Promise<void>;
}
```

### How Exporters Receive Events

**Flow** (BaseObservabilityInstance):

1. `startSpan()` calls `emitSpanStarted()` (line 130)
2. `wireSpanLifecycle()` wraps `end()` and `update()` methods (line 127)
3. When wrapped methods are called, they trigger `emitSpanEnded()` or `emitSpanUpdated()`
4. Each emit method calls `exportTracingEvent()` (lines 404-418)

**exportTracingEvent()** (BaseObservabilityInstance lines 404-418):

```typescript
protected async exportTracingEvent(event: TracingEvent): Promise<void> {
  const exportPromises = this.exporters.map(async exporter => {
    try {
      if (exporter.exportTracingEvent) {
        await exporter.exportTracingEvent(event);
        this.logger.debug(`[Observability] Event exported [exporter=${exporter.name}] [type=${event.type}]`);
      }
    } catch (error) {
      this.logger.error(`[Observability] Export error [exporter=${exporter.name}]`, error);
    }
  });

  await Promise.allSettled(exportPromises);
}
```

### Default Exporter: Multiple Strategies

**Location**: `exporters/default.ts` lines 54-661

**Three Strategies**:

1. **realtime**: Each event immediately persisted to storage
2. **batch-with-updates**: Events buffered, processed in batches with CRUD operations
3. **insert-only**: Only SPAN_ENDED events persisted, once per span

**Strategy Selection**: Determined by `storage.tracingStrategy.preferred` at init time (line 136-146)

## 5. Current Context Propagation

### RequestContext System

**Location**: `/Users/epinzur/src/github.com/mastra/mastra/packages/core/src/request-context/index.ts`

```typescript
export class RequestContext<Values extends Record<string, any> | unknown = unknown> {
  private registry = new Map<string, unknown>();

  public set<K extends ...>(key: K, value: ...): void { ... }
  public get<K extends ...>(key: K): unknown { ... }
  public has<K extends ...>(key: K): boolean { ... }
  // ... other methods
}
```

**Purpose**: Type-safe, scoped context for request-level data

**Usage in Observability**:

1. RequestContext passed through execution chain
2. TraceState computed at root span time with configured `requestContextKeys`
3. Metadata extracted from RequestContext using TraceState keys (BaseObservabilityInstance lines 281-331)

### TraceState System

**Type**: `types/tracing.ts` lines 652-659:

```typescript
export interface TraceState {
  /**
   * RequestContext keys to extract as metadata for all spans in this trace.
   * Computed by merging the tracing config's requestContextKeys
   * with the per-request requestContextKeys.
   */
  requestContextKeys: string[];
}
```

**Computation**: BaseObservabilityInstance.computeTraceState() (lines 262-276):

```typescript
protected computeTraceState(tracingOptions?: TracingOptions): TraceState | undefined {
  const configuredKeys = this.config.requestContextKeys ?? [];
  const additionalKeys = tracingOptions?.requestContextKeys ?? [];

  // Merge: configured + additional
  const allKeys = [...configuredKeys, ...additionalKeys];

  if (allKeys.length === 0) {
    return undefined; // No metadata extraction needed
  }

  return {
    requestContextKeys: allKeys,
  };
}
```

**Metadata Extraction**: BaseObservabilityInstance.extractMetadataFromRequestContext() (lines 281-331):

```typescript
protected extractMetadataFromRequestContext(
  requestContext: RequestContext | undefined,
  explicitMetadata: Record<string, any> | undefined,
  traceState: TraceState | undefined,
): Record<string, any> | undefined {
  if (!requestContext || !traceState || traceState.requestContextKeys.length === 0) {
    return explicitMetadata;
  }

  const extracted = this.extractKeys(requestContext, traceState.requestContextKeys);

  if (Object.keys(extracted).length === 0 && !explicitMetadata) {
    return undefined;
  }

  return {
    ...extracted,
    ...explicitMetadata, // Explicit metadata always wins
  };
}
```

**Supports Dot Notation**: `extractKeys()` (lines 306-331) supports nested paths like "user.id", "session.data.experimentId"

### No Automatic W3C Context Extraction Currently

**Key Finding**: Mastra does NOT currently extract W3C Trace Context headers automatically.

Context propagation requires:

1. User explicitly passes `traceId` and `parentSpanId` via `tracingOptions`
2. OR incoming trace context is stored in RequestContext manually by caller
3. RequestContext is then passed through execution chain

## 6. Span Creation Flow Example

### How Agent Creates a Span

**Location**: `packages/core/src/agent/agent.ts` (relevant lines):

```typescript
const agentSpan = getOrCreateSpan({
  type: SpanType.AGENT_RUN,
  name: `agent run: '${this.id}'`,
  input: options.messages,
  attributes: {
    agentId: this.id,
    availableTools: ...,
    maxSteps: ...,
  },
  tracingPolicy,
  tracingContext,
  requestContext,
  tracingOptions,
  mastra: this.#mastra,
});
```

### What Happens

1. `getOrCreateSpan()` called with tracing context
2. If `tracingContext.currentSpan` exists:
   - Creates **child span** via `currentSpan.createChildSpan()`
   - Child inherits parent's traceId automatically
3. If no current span:
   - Gets ObservabilityInstance via `mastra.observability.getSelectedInstance()`
   - Calls `instance.startSpan()` to create **root span**
   - Uses `tracingOptions.traceId` if provided, else generates new one
4. BaseObservabilityInstance:
   - Checks sampling
   - Computes/inherits TraceState
   - Extracts RequestContext metadata
   - Creates actual Span via `createSpan()`
   - Wraps lifecycle methods
   - Emits SPAN_STARTED event
5. Exporters receive SPAN_STARTED event with ExportedSpan

## 7. ExportedSpan Structure

**Location**: `types/tracing.ts` lines 407-412:

```typescript
export interface ExportedSpan<TType extends SpanType> extends BaseSpan<TType> {
  /** Parent span id reference (undefined for root spans) */
  parentSpanId?: string;
  /** `TRUE` if the span is the root span of a trace */
  isRootSpan: boolean;
}
```

**Exported Properties**:

- `id`: Span ID (16 hex chars)
- `traceId`: Trace ID (32 hex chars)
- `parentSpanId`: Parent span ID if not root
- `name`: Human-readable span name
- `type`: SpanType enum
- `startTime`: Date when span started
- `endTime`: Date when span ended (if finished)
- `attributes`: Type-specific metadata (ModelGenerationAttributes, ToolCallAttributes, etc.)
- `metadata`: Custom metadata
- `input`: Input data
- `output`: Output data
- `errorInfo`: Error details if span failed
- `isEvent`: True if event-type span
- `isRootSpan`: True if root of trace

## 8. Key Integration Points for OpenTelemetry Bridge

### 1. **Span Context Injection** (CRITICAL)

- **Where**: `getOrCreateSpan()` function
- **What**: Before calling `startSpan()`, extract W3C Trace Context from RequestContext
- **How**: Check RequestContext for standard W3C header keys, validate, inject into tracingOptions

### 2. **Span Context Extraction** (CRITICAL)

- **Where**: BaseObservabilityInstance.startSpan() or DefaultSpan constructor
- **What**: Validate and potentially augment traceId/parentSpanId with OpenTelemetry requirements
- **How**: Ensure IDs are valid hex, correct lengths, non-zero values

### 3. **Event Export**

- **Where**: BaseObservabilityInstance.exportTracingEvent()
- **What**: Bridge receives same TracingEvent as other exporters
- **How**: Implement bridge's exportTracingEvent() to send to OpenTelemetry collector

### 4. **RequestContext Integration**

- **Where**: Caller code that creates RequestContext
- **What**: Store W3C trace context headers in RequestContext
- **How**: Set keys like "traceparent", "tracestate" in RequestContext at request boundary

## 9. No-Op Span System

**Location**: `/Users/epinzur/src/github.com/mastra/mastra/observability/mastra/src/spans/no-op.ts`

- Created when sampling returns false
- All lifecycle methods are no-ops
- `isValid` property returns false
- Used to avoid memory allocation when tracing disabled

## 10. Sampling System

**Location**: BaseObservabilityInstance.shouldSample() (lines 235-257)

**Four Strategies**:

1. `ALWAYS`: Always sample (default)
2. `NEVER`: Never sample
3. `RATIO`: Sample with probability (0-1)
4. `CUSTOM`: Custom sampler function

**Called At**: startSpan() entry point (line 99)

## Summary: Critical Data Flow

```
1. Agent/Workflow Code
   ↓
2. getOrCreateSpan({ type, tracingOptions, tracingContext, requestContext, ... })
   ↓ (if tracingContext.currentSpan exists)
3. currentSpan.createChildSpan() → startSpan() [child path]
   ↓ (if no current span)
3. getSelectedInstance() → startSpan() [root path]
   ↓
4. startSpan() decision:
   - Check sampling → NoOpSpan or proceed
   - Inherit/compute TraceState
   - Extract RequestContext metadata
   - Call createSpan()
   ↓
5. DefaultSpan constructor:
   - Generate ID (16 hex chars)
   - Assign traceId (32 hex chars):
     * From parent.traceId if child
     * From tracingOptions.traceId if provided
     * Generate new if root
   - Set parentSpanId if provided
   ↓
6. wireSpanLifecycle():
   - Wrap end(), update() methods
   - Inject event emission logic
   ↓
7. emitSpanStarted():
   - Create ExportedSpan
   - Send TracingEvent to all exporters
   ↓
8. Exporters:
   - BaseExporter.exportTracingEvent() → _exportTracingEvent()
   - DefaultExporter: Buffer or persist based on strategy
   - Custom exporters: Send to external systems
```

## Files Summary

**Core Types** (438 lines):

- `/packages/core/src/observability/types/tracing.ts`

**Utilities**:

- `/packages/core/src/observability/utils.ts` - getOrCreateSpan()
- `/packages/core/src/observability/context.ts` - Proxy-based context propagation

**Implementations**:

- `/observability/mastra/src/instances/base.ts` - BaseObservabilityInstance (452 lines)
- `/observability/mastra/src/instances/default.ts` - DefaultObservabilityInstance (16 lines)
- `/observability/mastra/src/spans/base.ts` - BaseSpan (200 lines)
- `/observability/mastra/src/spans/default.ts` - DefaultSpan (187 lines)
- `/observability/mastra/src/spans/no-op.ts` - NoOpSpan (35 lines)
- `/observability/mastra/src/exporters/base.ts` - BaseExporter (162 lines)
- `/observability/mastra/src/exporters/default.ts` - DefaultExporter (661 lines)

**Registry**:

- `/observability/mastra/src/registry.ts` - ObservabilityRegistry (118 lines)
