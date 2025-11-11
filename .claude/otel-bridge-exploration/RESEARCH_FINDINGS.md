# OpenTelemetry Bridge Research Findings

## Executive Summary

This document contains research findings for implementing an OpenTelemetry bridge for Mastra observability. The bridge will enable Mastra to integrate seamlessly with existing OpenTelemetry infrastructure by extracting trace context from OTEL and exporting Mastra spans back to OTEL collectors.

## Problem Statement

Currently, Mastra observability operates independently from OpenTelemetry instrumentation. This causes trace context to break at the Mastra boundary, resulting in disconnected traces. Users need Mastra to:

1. **Extract and consume** OTEL trace context (traceId, parentSpanId) when creating spans
2. **Export Mastra spans** to OTEL collectors as part of the same distributed trace
3. **Work with existing OTEL infrastructure** without requiring major changes

## Two Key Scenarios

### Scenario 1: HTTP Headers (Hono Example)

**Source**: https://github.com/treasur-inc/mastra-hono-tracing-example

**Setup**:

- Three services: service-one → service-two → service-mastra
- Each service uses Hono with `@hono/otel` middleware
- OTEL auto-instrumentation for HTTP/fetch
- W3C Trace Context propagation via `traceparent` header
- Traces exported to Arize

**Problem**:

- Trace context propagates successfully between service-one and service-two
- Context BREAKS at service-mastra boundary
- Mastra creates NEW trace with different traceId
- Result: Disconnected traces in Arize dashboard

**Root Cause**:

- Mastra doesn't read the `traceparent` header from incoming requests
- Mastra doesn't extract traceId/spanId from request headers
- Mastra starts fresh traces instead of continuing existing ones

**What's Needed**:

1. Extract W3C traceparent header: `00-{traceId}-{parentSpanId}-{flags}`
2. Pass extracted traceId and parentSpanId to `tracingOptions` when calling agent.generate()
3. Export Mastra spans to the same OTEL collector as other services

### Scenario 2: Active OTEL Context (Internal Example)

**Source**: examples/stripped-agent-hub-export

**Setup**:

- Full OpenTelemetry NodeSDK initialized with `startTelemetry()`
- Auto-instrumentation for Node.js (HTTP, Fastify, etc.)
- Custom span processors (DataUriRemovingProcessor)
- BatchSpanProcessor exporting to OTLP collector
- Mastra agents/workflows called within OTEL-instrumented code

**Problem**:

- OTEL context is active when Mastra code runs (agent.generate(), run.execute())
- Mastra doesn't access the active OTEL context
- Mastra creates independent traces instead of child spans
- Result: Disconnected traces even though OTEL is managing parent context

**Root Cause**:

- Mastra doesn't call `trace.getSpan(context.active())` to get active OTEL span
- Mastra doesn't extract traceId/spanId from active OTEL context
- Mastra starts fresh traces instead of continuing active ones

**What's Needed**:

1. Access active OTEL context using `@opentelemetry/api`
2. Extract traceId and spanId from active span
3. Pass to `tracingOptions` when creating root Mastra spans
4. Export Mastra spans through existing OTEL BatchSpanProcessor

## Current Mastra Architecture

### Span Creation Flow

**Entry Point**: `getOrCreateSpan()` in packages/core/src/observability/utils.ts:12-47

```typescript
export function getOrCreateSpan<T extends SpanType>(options: GetOrCreateSpanOptions<T>): Span<T> | undefined {
  const { type, attributes, tracingContext, requestContext, tracingOptions, ...rest } = options;

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
    traceId: tracingOptions?.traceId, // ← ALREADY SUPPORTS EXTERNAL TRACE ID!
    parentSpanId: tracingOptions?.parentSpanId, // ← ALREADY SUPPORTS PARENT SPAN ID!
    customSamplerOptions: {
      requestContext,
      metadata,
    },
  });
}
```

**Key Finding**: The infrastructure to accept external traceId and parentSpanId **already exists**! The issue is that nothing is populating these values from OTEL context.

### TraceId Assignment Logic

**Location**: observability/mastra/src/spans/default.ts:16-49

```typescript
constructor(options: CreateSpanOptions<TType>, observabilityInstance: ObservabilityInstance) {
  this.traceId = this.assignTraceId(options);
  // ... rest of constructor
}

private assignTraceId(options: CreateSpanOptions<TType>): string {
  // Case 1: Child span - inherit from parent
  if (options.parent) {
    return options.parent.traceId;
  }

  // Case 2: Root span with explicit traceId
  if (options.traceId) {
    const validated = validateHexString(options.traceId, 32);
    if (validated) {
      return validated;
    }
    // Invalid traceId - log warning and generate new one
    this.observabilityInstance.getLogger().warn(
      `Invalid traceId format: ${options.traceId}. Generating new traceId.`
    );
  }

  // Case 3: Generate new traceId
  return generateTraceId();
}
```

**Key Finding**: TraceId assignment already supports external values through `options.traceId`. It validates hex format (32 chars) and falls back to generation if invalid.

### Exporter System

**Base Class**: observability/mastra/src/exporters/base.ts

**Key Methods**:

- `exportTracingEvent(event: TracingEvent)`: Public method called by ObservabilityInstance
- `_exportTracingEvent(event: TracingEvent)`: Abstract method implemented by subclasses
- Event types: SPAN_STARTED, SPAN_UPDATED, SPAN_ENDED

**Existing OTEL Integration**: observability/otel-exporter/

**Purpose**: Converts Mastra spans to OpenTelemetry spans and exports to OTEL collectors

**Key Classes**:

- `OtelExporter` extends `BaseExporter`
- `SpanConverter`: Converts Mastra ExportedSpan → OTEL ReadableSpan
- Uses `BatchSpanProcessor` to batch and export spans
- Only processes `SPAN_ENDED` events (OTEL needs complete spans)

**Key Finding**: Mastra → OTEL export already exists! The OtelExporter can be reused or referenced for the bridge implementation.

## Current ObservabilityBridge Interface

**Location**: packages/core/src/observability/types/tracing.ts:842-860

```typescript
export interface ObservabilityBridge {
  /** Bridge name */
  name: string;

  /** Initialize bridge with observability configuration and/or access to Mastra */
  init?(options: InitBridgeOptions): void;

  /** Sets logger instance on the bridge  */
  __setLogger?(logger: IMastraLogger): void;

  /** Export tracing events */
  exportTracingEvent(event: TracingEvent): Promise<void>;

  /** Shutdown bridge */
  shutdown(): Promise<void>;
}
```

**Analysis**: This interface is similar to `ObservabilityExporter` but doesn't include the context extraction capability mentioned in your proposed interface.

## Your Proposed Interface

```typescript
interface ObservabilityBridge {
  // Called by getOrCreateSpan() to get context for new span
  getCurrentContext():
    | {
        traceId: string;
        parentSpanId?: string;
        isSampled: boolean;
      }
    | undefined;

  // Should bridge also receive events? Or just provide context?
  onSpanEvent?(event: AITracingEvent): void;

  shutdown(): Promise<void>;
}
```

## Critical Questions & Answers

### Q1: Should the bridge provide context, export events, or both?

**Answer**: BOTH, but through different mechanisms:

1. **Context Injection** (getCurrentContext):
   - Called at span creation time
   - Extracts OTEL context and returns traceId/parentSpanId
   - Needs to be synchronous and lightweight
   - Should be called from `getOrCreateSpan()` or `ObservabilityInstance.startSpan()`

2. **Event Export** (exportTracingEvent):
   - Converts Mastra spans to OTEL spans
   - Exports through OTEL SDK to collectors
   - Can reuse much of the existing OtelExporter logic
   - Asynchronous, batched

### Q2: Where should getCurrentContext() be called?

**Options**:

A. **In getOrCreateSpan()** (packages/core/src/observability/utils.ts)

- Pros: Central location, catches all root span creation
- Cons: Requires access to ObservabilityInstance to get bridge

B. **In ObservabilityInstance.startSpan()** (observability/mastra/src/instances/base.ts:96-134)

- Pros: Has access to bridge, can inject before creating span
- Cons: Only affects ObservabilityInstance, not direct span creation

C. **Both locations**

- Best option: Check in getOrCreateSpan() first, fallback to startSpan()

**Recommendation**: Modify `getOrCreateSpan()` to:

```typescript
export function getOrCreateSpan<T extends SpanType>(options: GetOrCreateSpanOptions<T>): Span<T> | undefined {
  // ... existing code ...

  // NEW: If no explicit traceId provided, try to get from bridge
  if (!tracingOptions?.traceId && !tracingContext?.currentSpan) {
    const instance = options.mastra?.observability?.getSelectedInstance({ requestContext });
    const bridge = instance?.getBridge(); // NEW METHOD NEEDED
    const bridgeContext = bridge?.getCurrentContext();

    if (bridgeContext) {
      tracingOptions = {
        ...tracingOptions,
        traceId: bridgeContext.traceId,
        parentSpanId: bridgeContext.parentSpanId,
      };
    }
  }

  // ... rest of function
}
```

### Q3: Should exporters be optional when bridge exists?

**Current**: ObservabilityInstanceConfig requires exporters

**Your Question**: If bridge exists, should exporters be optional?

**Answer**: YES, exporters should be optional when bridge exists:

1. In bridge mode, spans are exported through OTEL infrastructure
2. No need for separate Mastra exporters
3. However, users might want BOTH (e.g., export to OTEL + Langfuse)

**Recommendation**: Make exporters optional in config:

```typescript
export interface ObservabilityInstanceConfig {
  name: string;
  serviceName: string;
  sampling?: SamplingStrategy;
  exporters?: ObservabilityExporter[]; // Already optional in type definition!
  spanOutputProcessors?: SpanOutputProcessor[];
  bridge?: ObservabilityBridge; // NEW
  includeInternalSpans?: boolean;
  requestContextKeys?: string[];
}
```

The type already has `exporters?:` (optional), so no type change needed. Just update validation logic.

### Q4: How to handle sampling when using bridge?

**OTEL Context includes isSampled flag**

Options:

1. Respect OTEL sampling decision (bridge returns isSampled)
2. Allow Mastra to make independent sampling decision
3. Combine both (AND logic)

**Recommendation**:

- If bridge context is present and `isSampled: false`, respect it (create NoOpSpan)
- If bridge context is present and `isSampled: true`, apply Mastra sampling strategy
- This allows OTEL to completely disable tracing while allowing Mastra to further filter

### Q5: How to extract context in Scenario 1 (HTTP headers)?

**W3C Trace Context Format**:

```
traceparent: 00-{traceId}-{parentSpanId}-{flags}
Example: 00-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-01
```

**Implementation**:

```typescript
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { context, trace, ROOT_CONTEXT } from '@opentelemetry/api';

class OtelBridge implements ObservabilityBridge {
  private propagator = new W3CTraceContextPropagator();

  getCurrentContext(): { traceId: string; parentSpanId?: string; isSampled: boolean } | undefined {
    // Try active context first (Scenario 2)
    const activeSpan = trace.getSpan(context.active());
    if (activeSpan) {
      const spanContext = activeSpan.spanContext();
      return {
        traceId: spanContext.traceId,
        parentSpanId: spanContext.spanId,
        isSampled: (spanContext.traceFlags & 1) === 1,
      };
    }

    // Fall back to headers (Scenario 1) - requires request context
    // This needs to be passed in somehow...
    return undefined;
  }
}
```

**Challenge**: In Scenario 1, we need access to HTTP headers. How do we get them?

**Solution**: Use RequestContext! The user can extract headers and put them in RequestContext:

```typescript
// In user's HTTP handler
await RuntimeContext.with(
  new Map([
    ['otel.headers', {
      traceparent: req.header('traceparent'),
      tracestate: req.header('tracestate'),
    }]
  ]),
  async () => {
    await agent.generate({ ... });
  }
);
```

Then bridge can extract from RequestContext:

```typescript
getCurrentContext(requestContext?: RequestContext): ... {
  // Try active context first
  const activeSpan = trace.getSpan(context.active());
  if (activeSpan) { ... }

  // Try headers from RequestContext
  const headers = requestContext?.get('otel.headers');
  if (headers?.traceparent) {
    const ctx = this.propagator.extract(ROOT_CONTEXT, headers, {
      get: (carrier, key) => carrier[key],
      keys: (carrier) => Object.keys(carrier),
    });
    const span = trace.getSpan(ctx);
    if (span) {
      const spanContext = span.spanContext();
      return {
        traceId: spanContext.traceId,
        parentSpanId: spanContext.spanId,
        isSampled: (spanContext.traceFlags & 1) === 1,
      };
    }
  }

  return undefined;
}
```

**Problem**: getCurrentContext() doesn't currently receive requestContext in your proposed interface!

**Solution**: Update interface:

```typescript
interface ObservabilityBridge {
  getCurrentContext(requestContext?: RequestContext):
    | {
        traceId: string;
        parentSpanId?: string;
        isSampled: boolean;
      }
    | undefined;

  exportTracingEvent(event: TracingEvent): Promise<void>;

  shutdown(): Promise<void>;
}
```

### Q6: How to export spans to OTEL in bridge mode?

**Two Approaches**:

**Approach A: Reuse Existing OTEL SDK**

- In Scenario 2, user has NodeSDK already initialized
- Bridge can access the global tracer provider
- Create "shadow" OTEL spans that mirror Mastra spans
- Export through existing BatchSpanProcessor

**Approach B: Standalone Export**

- Bridge creates its own OTEL exporter
- Similar to existing OtelExporter package
- Independent from user's OTEL setup

**Recommendation**: Support both through configuration:

```typescript
interface OtelBridgeConfig {
  // Context extraction strategy
  extractFrom?: 'active-context' | 'headers' | 'both'; // default: 'both'

  // Export strategy
  export?: {
    // Option 1: Use existing OTEL SDK (Scenario 2)
    useActiveProvider?: boolean;

    // Option 2: Standalone exporter (Scenario 1 or when no SDK)
    exporter?: SpanExporter;
    provider?: {
      endpoint: string;
      headers?: Record<string, string>;
      protocol?: 'http/protobuf' | 'http/json' | 'grpc';
    };
  };
}
```

## OpenTelemetry APIs Needed

### For Context Extraction

```typescript
import { trace, context } from '@opentelemetry/api';

// Get active span
const activeSpan = trace.getSpan(context.active());
const spanContext = activeSpan?.spanContext();
// spanContext.traceId - 32 hex chars
// spanContext.spanId - 16 hex chars
// spanContext.traceFlags - bit 0 is sampled flag
```

### For Header Extraction

```typescript
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { ROOT_CONTEXT } from '@opentelemetry/api';

const propagator = new W3CTraceContextPropagator();
const ctx = propagator.extract(ROOT_CONTEXT, headers, {
  get: (carrier, key) => carrier[key],
  keys: carrier => Object.keys(carrier),
});
```

### For Span Export

```typescript
import { ReadableSpan, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';

// Option 1: Use existing processor
const processor = new BatchSpanProcessor(exporter);
processor.onEnd(readableSpan);

// Option 2: Access global provider (if available)
import { trace } from '@opentelemetry/api';
const tracer = trace.getTracer('@mastra/otel-bridge');
const span = tracer.startSpan('operation', { ... });
```

## Package Dependencies

The otel-bridge package will need:

```json
{
  "dependencies": {
    "@mastra/observability": "workspace:*",
    "@opentelemetry/api": "^1.9.0",
    "@opentelemetry/core": "^2.1.0",
    "@opentelemetry/resources": "^2.1.0",
    "@opentelemetry/sdk-trace-base": "^2.1.0",
    "@opentelemetry/semantic-conventions": "^1.37.0"
  },
  "peerDependencies": {
    "@mastra/core": ">=1.0.0-0 <2.0.0-0"
  }
}
```

These match what otel-exporter already uses, so we can reference that implementation.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  HTTP Request with traceparent header (Scenario 1)          │
│  OR                                                          │
│  OTEL-instrumented code with active context (Scenario 2)    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  User Application Code                                       │
│                                                              │
│  RuntimeContext.with(                                        │
│    new Map([['otel.headers', { traceparent: ... }]]),       │
│    async () => {                                            │
│      await agent.generate({                                 │
│        tracingOptions: { ... }  // optional manual override │
│      });                                                     │
│    }                                                         │
│  );                                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  getOrCreateSpan() - packages/core/src/observability/utils.ts
│                                                              │
│  1. Check if tracingContext.currentSpan exists              │
│     → Yes: Create child span (no bridge needed)             │
│     → No: Continue to step 2                                │
│                                                              │
│  2. Check if tracingOptions has traceId                     │
│     → Yes: Use provided traceId/parentSpanId                │
│     → No: Continue to step 3                                │
│                                                              │
│  3. Get ObservabilityInstance and bridge                    │
│  4. Call bridge.getCurrentContext(requestContext)           │
│     → Returns traceId, parentSpanId, isSampled              │
│  5. Inject into tracingOptions                              │
│  6. Call instance.startSpan(...)                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  OtelBridge.getCurrentContext(requestContext)                │
│                                                              │
│  Strategy: Try multiple sources in order                     │
│                                                              │
│  1. Active OTEL Context (Scenario 2)                        │
│     const span = trace.getSpan(context.active())            │
│     if (span) return span.spanContext()                     │
│                                                              │
│  2. RequestContext Headers (Scenario 1)                     │
│     const headers = requestContext.get('otel.headers')      │
│     if (headers?.traceparent) {                             │
│       extract using W3CTraceContextPropagator               │
│       return extracted context                              │
│     }                                                        │
│                                                              │
│  3. Return undefined (no OTEL context available)            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  ObservabilityInstance.startSpan()                           │
│                                                              │
│  - Applies sampling strategy                                │
│    (respects isSampled from bridge if provided)             │
│  - Creates span with external traceId/parentSpanId          │
│  - Emits SPAN_STARTED, SPAN_UPDATED, SPAN_ENDED events     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Event Distribution                                          │
│                                                              │
│  ┌────────────────────────────────────────────┐            │
│  │ Exporters (if configured)                  │            │
│  │ - LangsmithExporter                        │            │
│  │ - LangfuseExporter                         │            │
│  │ - etc.                                     │            │
│  └────────────────────────────────────────────┘            │
│                                                              │
│  ┌────────────────────────────────────────────┐            │
│  │ OtelBridge.exportTracingEvent()            │            │
│  │                                            │            │
│  │ On SPAN_ENDED:                             │            │
│  │ 1. Convert Mastra span to OTEL span        │            │
│  │ 2. Export via:                             │            │
│  │    - Active OTEL provider (if available)   │            │
│  │    - Standalone exporter (fallback)        │            │
│  └────────────────────────────────────────────┘            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  OTEL Collector / Backend                                    │
│  - Jaeger, Zipkin, Arize, Honeycomb, etc.                   │
│                                                              │
│  Result: Complete distributed trace with:                    │
│  - HTTP service spans (from OTEL auto-instrumentation)      │
│  - Mastra agent/workflow spans (from bridge)                │
│  - All under same traceId                                   │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Interface Design

**Recommendation**:

```typescript
export interface ObservabilityBridge {
  /** Bridge name */
  name: string;

  /** Initialize bridge with observability configuration */
  init?(options: InitBridgeOptions): void;

  /** Sets logger instance on the bridge */
  __setLogger?(logger: IMastraLogger): void;

  /**
   * Get current OTEL context for span creation
   * Called by getOrCreateSpan() when creating root spans
   *
   * @param requestContext - Optional request context with headers/metadata
   * @returns OTEL context or undefined if not available
   */
  getCurrentContext(requestContext?: RequestContext):
    | {
        traceId: string;
        parentSpanId?: string;
        isSampled: boolean;
      }
    | undefined;

  /**
   * Export Mastra tracing events to OTEL infrastructure
   * Called for SPAN_STARTED, SPAN_UPDATED, SPAN_ENDED events
   *
   * @param event - Tracing event with exported span
   */
  exportTracingEvent(event: TracingEvent): Promise<void>;

  /** Shutdown bridge and cleanup resources */
  shutdown(): Promise<void>;
}
```

### 2. Configuration Design

```typescript
export interface ObservabilityInstanceConfig {
  name: string;
  serviceName: string;
  sampling?: SamplingStrategy;
  exporters?: ObservabilityExporter[]; // Already optional
  spanOutputProcessors?: SpanOutputProcessor[];
  bridge?: ObservabilityBridge; // NEW
  includeInternalSpans?: boolean;
  requestContextKeys?: string[];
}
```

**Validation Rules**:

- At least one of `exporters` or `bridge` must be provided
- If `bridge` is provided and `exporters` is empty, that's valid
- If neither is provided, throw configuration error

### 3. Core Package Changes

**Minimal changes needed**:

1. **Add getBridge() method to ObservabilityInstance**:

```typescript
export interface ObservabilityInstance {
  // ... existing methods ...
  getBridge(): ObservabilityBridge | undefined; // NEW
}
```

2. **Update getOrCreateSpan() to use bridge**:

```typescript
export function getOrCreateSpan<T extends SpanType>(options: GetOrCreateSpanOptions<T>): Span<T> | undefined {
  const { type, attributes, tracingContext, requestContext, tracingOptions, ...rest } = options;

  // Existing: merge metadata
  const metadata = {
    ...(rest.metadata ?? {}),
    ...(tracingOptions?.metadata ?? {}),
  };

  // Existing: If we have a current span, create a child span
  if (tracingContext?.currentSpan) {
    return tracingContext.currentSpan.createChildSpan({
      type,
      attributes,
      ...rest,
      metadata,
    });
  }

  // NEW: Try to get OTEL context from bridge if no explicit traceId
  let enhancedTracingOptions = tracingOptions;
  if (!tracingOptions?.traceId) {
    const instance = options.mastra?.observability?.getSelectedInstance({ requestContext });
    const bridge = instance?.getBridge();
    const bridgeContext = bridge?.getCurrentContext(requestContext);

    if (bridgeContext) {
      enhancedTracingOptions = {
        ...tracingOptions,
        traceId: bridgeContext.traceId,
        parentSpanId: bridgeContext.parentSpanId,
      };

      // If OTEL says don't sample, respect that
      if (!bridgeContext.isSampled) {
        return undefined; // or create NoOpSpan
      }
    }
  }

  // Existing: try to create a new root span
  const instance = options.mastra?.observability?.getSelectedInstance({ requestContext });

  return instance?.startSpan<T>({
    type,
    attributes,
    ...rest,
    metadata,
    requestContext,
    tracingOptions: enhancedTracingOptions, // Use enhanced options
    traceId: enhancedTracingOptions?.traceId,
    parentSpanId: enhancedTracingOptions?.parentSpanId,
    customSamplerOptions: {
      requestContext,
      metadata,
    },
  });
}
```

3. **Update ObservabilityInstance to distribute events to bridge**:

```typescript
// In observability/mastra/src/instances/base.ts

protected async emitTracingEvent(event: TracingEvent): Promise<void> {
  const exporters = this.exporters;
  const bridge = this.bridge;  // NEW

  const targets = [...exporters];
  if (bridge) {
    targets.push(bridge);  // Bridge has same exportTracingEvent interface
  }

  const results = await Promise.allSettled(
    targets.map(target => target.exportTracingEvent(event))
  );

  // Log any failures
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const target = targets[index];
      this.logger.error(
        `Failed to export ${event.type} event to ${target.name}:`,
        result.reason
      );
    }
  });
}
```

### 4. User Experience

**Scenario 1: HTTP Headers**

```typescript
// User code - Hono example
import { Hono } from 'hono';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { OtelBridge } from '@mastra/otel-bridge';

const app = new Hono();

// Configure Mastra with bridge
const mastra = new Mastra({
  // ...
  observability: {
    configs: {
      default: {
        serviceName: 'my-service',
        bridge: new OtelBridge({
          export: {
            provider: {
              endpoint: 'http://localhost:4318/v1/traces',
              protocol: 'http/protobuf',
            },
          },
        }),
      },
    },
  },
});

// HTTP handler
app.post('/api/chat', async c => {
  // Extract OTEL headers
  const traceparent = c.req.header('traceparent');
  const tracestate = c.req.header('tracestate');

  // Run with OTEL context in RequestContext
  const result = await RuntimeContext.with(new Map([['otel.headers', { traceparent, tracestate }]]), async () => {
    return await agent.generate({
      messages: [{ role: 'user', content: 'Hello' }],
    });
  });

  return c.json(result);
});
```

**Scenario 2: Active OTEL Context**

```typescript
// User code - already has OTEL initialized
import { startTelemetry } from './telemetry/init';
import { OtelBridge } from '@mastra/otel-bridge';

// OTEL is already running (from instrumentation-hook.js)
// NodeSDK with auto-instrumentations is active

// Configure Mastra with bridge
const mastra = new Mastra({
  // ...
  observability: {
    configs: {
      default: {
        serviceName: 'my-service',
        bridge: new OtelBridge({
          extractFrom: 'active-context',
          export: {
            useActiveProvider: true, // Use existing OTEL SDK
          },
        }),
      },
    },
  },
});

// Mastra automatically picks up active OTEL context
// No need to manually pass headers or context
app.post('/api/chat', async c => {
  // OTEL HTTP instrumentation has already created a span
  // Bridge will automatically detect it
  const result = await agent.generate({
    messages: [{ role: 'user', content: 'Hello' }],
  });

  return c.json(result);
});
```

## Implementation Phases

### Phase 1: Core Changes (Required)

- [ ] Update ObservabilityBridge interface with getCurrentContext()
- [ ] Add getBridge() method to ObservabilityInstance interface
- [ ] Update BaseObservabilityInstance to store and expose bridge
- [ ] Update getOrCreateSpan() to call bridge.getCurrentContext()
- [ ] Update event distribution to include bridge
- [ ] Update config validation to allow exporters to be optional when bridge exists

### Phase 2: OtelBridge Implementation (otel-bridge package)

- [ ] Create OtelBridge class implementing ObservabilityBridge
- [ ] Implement getCurrentContext() with dual strategy (active context + headers)
- [ ] Implement exportTracingEvent() with dual export strategy
- [ ] Add configuration options (extractFrom, export strategies)
- [ ] Add comprehensive error handling and logging
- [ ] Write unit tests

### Phase 3: Integration Testing

- [ ] Test Scenario 1 with Hono example (headers)
- [ ] Test Scenario 2 with Internal example (active context)
- [ ] Test span export to various OTEL backends (Jaeger, Zipkin, OTLP)
- [ ] Test sampling behavior
- [ ] Test error cases (invalid headers, no context, etc.)

### Phase 4: Documentation

- [ ] Update Mastra observability docs
- [ ] Create OtelBridge usage guide
- [ ] Add examples for both scenarios
- [ ] Document RequestContext patterns for header extraction
- [ ] Add troubleshooting guide

## Open Questions for Discussion

1. **RequestContext convention**: Should we standardize on `'otel.headers'` as the key, or make it configurable?

Response: Not sure on this... what does otel use internally? Can we use a otel package to manage these headers instead of using our request context? Maybe there is a middleware that can grab the headers for us?

2. **Sampling interaction**: Current proposal respects OTEL's isSampled=false but applies Mastra sampling on top. Is this the right behavior?

Response: This makes sense, but if it is easier, we can just respect OTEL's sampling if we are operating in Bridge-mode, and ignore mastra's sampling.

3. **Export strategy priority**: Should we auto-detect active OTEL provider first, then fall back to standalone exporter? Or require explicit configuration?

Response: If we can auto-detect, that would be amazing.

4. **Span kind mapping**: The existing OtelExporter maps Mastra span types to OTEL SpanKind. Should the bridge do the same, or let users customize?

Response: The bridge should map Mastra spans to OTEL spans, ideally re-using the logic from the OtelExporter... maybe the bridge can just use the OtelExporter internally, or we could move some logic to a shared package?

5. **Error handling**: If bridge.getCurrentContext() throws an error, should we:
   - Create a new trace (current behavior)
   - Create NoOpSpan (disable tracing)
   - Propagate the error

Response: I think create a new trace, but also log a warning.

6. **Bridge vs Exporter**: Should OtelBridge extend BaseExporter, or should it be a separate concept? Current proposal makes it separate but with same exportTracingEvent interface.

Response: Lets keep it a separate concept for now. But I reserve the right to change my mind.

7. **Multiple bridges**: Should we support multiple bridges (e.g., OTEL + custom)? Current design allows only one bridge per instance.

Response: Lets start with 0 or 1 bridges for now.

## References

- User Example 1: https://github.com/treasur-inc/mastra-hono-tracing-example
- User Example 2: examples/stripped-agent-hub-export
- Existing OtelExporter: observability/otel-exporter/
- Mastra Architecture Docs: .claude/otel-bridge-exploration/ARCHITECTURE.md
- OTEL Trace Context Spec: https://www.w3.org/TR/trace-context/
- OTEL JS SDK Docs: https://opentelemetry.io/docs/languages/js/
