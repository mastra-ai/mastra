# OTEL Bridge Context Propagation - Design Document

## Problem Statement

When Mastra creates spans for operations (agent runs, LLM calls, tool executions), the OtelBridge creates corresponding OTEL spans. However, when auto-instrumented operations (HTTP requests, database queries) happen within those Mastra operations, they don't know about the Mastra span context and end up parented incorrectly.

### Example Issue

Current hierarchy (incorrect):

```
- demo-controller
  - agent run: 'Science Chat Agent'
    - llm: 'gpt-4o-mini'
      - step: 0
        - chunk: 'text'
  - POST (OpenAI API call)     ← Should be under 'llm' span
  - dns.lookup                  ← Should be under 'llm' span
  - tls.connect                 ← Should be under 'llm' span
```

Desired hierarchy (correct):

```
- demo-controller
  - agent run: 'Science Chat Agent'
    - llm: 'gpt-4o-mini'
      - POST (OpenAI API call)  ← Correctly nested
        - dns.lookup
        - tls.connect
      - step: 0
        - chunk: 'text'
```

## Design Decisions

### 1. Bridge-Per-Config is Correct

After research into Mastra's observability architecture, we confirmed that **bridge-per-config is the correct design**:

**Why:**

- Configs represent complete, independent observability pipelines selected at runtime
- Only ONE config is active per execution (one bridge per trace)
- ConfigSelector pattern enables sophisticated routing (by environment, customer tier, region, etc.)
- Different environments/use-cases can have different OTEL integration needs

**Example Use Cases:**

```typescript
new Observability({
  configs: {
    development: {
      serviceName: 'my-service-dev',
      // No bridge in dev - just console logging
    },
    production: {
      serviceName: 'my-service-prod',
      bridge: new OtelBridge(), // Production OTEL collector
    },
    premium: {
      serviceName: 'my-service-premium',
      bridge: new OtelBridge({
        /* enhanced config */
      }),
    },
  },
  configSelector: context => {
    if (process.env.NODE_ENV === 'development') return 'development';
    if (context.requestContext?.get('tier') === 'premium') return 'premium';
    return 'production';
  },
});
```

### 2. Keep OTEL References Out of @mastra/core

All OTEL imports and dependencies must stay in `@mastra/otel-bridge`. The core package should only interact with the bridge through abstract interfaces.

### 3. Context Propagation Through Span Methods

Instead of requiring parameters everywhere, make context propagation a method on the Span interface itself. The span already has access to all needed context.

## Implementation Design

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────┐
│ Usage Layer (@mastra/core)                      │
│                                                  │
│ executeWithContext(tracingContext, () => fn())  │
│   ↓ uses                                        │
│ span.executeInContext(() => fn())               │
└─────────────────────────────────────────────────┘
                    ↓ delegates to
┌─────────────────────────────────────────────────┐
│ Interface Layer (@mastra/core)                  │
│                                                  │
│ interface Span {                                │
│   executeInContext<T>(fn: () => Promise<T>)    │
│ }                                               │
│                                                  │
│ interface ObservabilityBridge {                 │
│   executeInContext<T>(spanId, fn)              │
│ }                                               │
└─────────────────────────────────────────────────┘
                    ↓ implemented by
┌─────────────────────────────────────────────────┐
│ Implementation Layer (@mastra/otel-bridge)      │
│                                                  │
│ OtelBridge.executeInContext(spanId, fn) {      │
│   const ctx = this.getSpanContext(spanId)      │
│   return otelContext.with(ctx, fn)             │
│ }                                               │
└─────────────────────────────────────────────────┘
```

## Implementation Details

### 1. Add to ObservabilityBridge Interface

**File:** `packages/core/src/observability/types/tracing.ts`

```typescript
export interface ObservabilityBridge {
  // ... existing methods ...

  /**
   * Execute a function within the tracing context of a Mastra span.
   * This enables auto-instrumented operations (HTTP, DB) to have correct parent spans
   * in the external tracing system (e.g., OpenTelemetry, DataDog, etc.).
   *
   * @param spanId - The ID of the Mastra span to use as context
   * @param fn - The function to execute within the span context
   * @returns The result of the function execution
   */
  executeInContext?<T>(spanId: string, fn: () => Promise<T>): Promise<T>;
}
```

### 2. Implement in OtelBridge

**File:** `observability/otel-bridge/src/bridge.ts`

```typescript
import { context as otelContext } from '@opentelemetry/api';

export class OtelBridge extends BaseExporter implements ObservabilityBridge {
  // ... existing implementation ...

  /**
   * Execute a function within the OTEL context of a Mastra span.
   * Retrieves the stored OTEL context for the span and executes the function within it.
   */
  executeInContext<T>(spanId: string, fn: () => Promise<T>): Promise<T> {
    const spanContext = this.getSpanContext(spanId);
    if (spanContext) {
      return otelContext.with(spanContext, fn);
    }
    return fn();
  }
}
```

**Note:** `getSpanContext()` already exists in the bridge (line 121), so we just use it.

### 3. Add executeInContext to Span Interface

**File:** `packages/core/src/observability/types/tracing.ts`

````typescript
export interface Span {
  id: string;
  name: string;
  type: string;
  // ... other existing properties ...

  /**
   * Execute a function within this span's tracing context.
   *
   * When a bridge is configured, this enables auto-instrumented operations
   * (HTTP requests, database queries, etc.) to be properly nested under this
   * span in the external tracing system.
   *
   * @param fn - The function to execute within the span context
   * @returns The result of the function execution
   *
   * @example
   * ```typescript
   * const result = await modelSpan.executeInContext(() => {
   *   return model.doStream(...);
   * });
   * ```
   */
  executeInContext<T>(fn: () => Promise<T>): Promise<T>;
}
````

### 4. Implement in Span Class

**File:** `observability/mastra/src/spans/base.ts` (BaseSpan class)

```typescript
// Add to BaseSpan class
export abstract class BaseSpan<TType extends SpanType = any> implements Span<TType> {
  // ... existing properties ...

  async executeInContext<T>(fn: () => Promise<T>): Promise<T> {
    const bridge = this.observabilityInstance.getBridge();

    if (bridge?.executeInContext) {
      return bridge.executeInContext(this.id, fn);
    }

    return fn();
  }
}
```

**Note:** The BaseSpan class already has access to `observabilityInstance` (set in constructor), which provides access to the bridge. No additional properties needed.

### 5. Add Helper for TracingContext Pattern

**File:** `packages/core/src/observability/utils.ts`

````typescript
/**
 * Execute a function within the current span's tracing context if available.
 * Falls back to direct execution if no span exists.
 *
 * When a bridge is configured, this enables auto-instrumented operations
 * (HTTP requests, database queries, etc.) to be properly nested under the
 * current span in the external tracing system.
 *
 * This is a convenience wrapper for the common pattern of checking if a span
 * exists in the tracing context before executing with context.
 *
 * @param tracingContext - The tracing context containing the current span
 * @param fn - The function to execute
 * @returns The result of the function execution
 *
 * @example
 * ```typescript
 * const result = await executeWithContext(tracingContext, () =>
 *   model.generateText(args)
 * );
 * ```
 */
export async function executeWithContext<T>(
  tracingContext: TracingContext | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const span = tracingContext?.currentSpan;

  if (span?.executeInContext) {
    return span.executeInContext(fn);
  }

  return fn();
}
````

## Usage Examples

### Model Generation (AI SDK V1)

**File:** `packages/core/src/llm/model/model.ts`

**Before:**

```typescript
// Line 254
const result: GenerateTextResult<Tools, Z> = await generateText(argsForExecute);
```

**After:**

```typescript
const result: GenerateTextResult<Tools, Z> = await executeWithContext(tracingContext, () =>
  generateText(argsForExecute),
);
```

**Benefits:**

- OpenAI HTTP requests will be nested under the `llm` span
- DNS, TLS, and other auto-instrumented operations get correct parent
- No bridge-specific imports in model.ts

### Tool Execution

**File:** `packages/core/src/tools/tool.ts`

**Before:**

```typescript
// Line 205
return originalExecute(data as any, organizedContext);
```

**After:**

```typescript
return executeWithContext(organizedContext.tracingContext, () => originalExecute(data as any, organizedContext));
```

**Benefits:**

- Any HTTP/DB operations in tool functions get correct parent
- Tool spans properly nest instrumented operations

### Loop Workflow LLM Step

**File:** `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts`

**Before:**

```typescript
// Line 534
modelResult = execute({
  runId,
  model: stepModel,
  // ... args
});
```

**After:**

```typescript
modelResult = await executeWithContext(tracingContext, () =>
  execute({
    runId,
    model: stepModel,
    // ... args
  }),
);
```

## Key Instrumentation Points

Based on codebase analysis, these are the primary locations to add `executeWithContext`:

1. **Model V1 Generation**
   - `packages/core/src/llm/model/model.ts:254` - generateText call
   - `packages/core/src/llm/model/model.ts:608` - streamText call

2. **Model VNext Loop**
   - `packages/core/src/llm/model/model.loop.ts:339` - loop() call

3. **Tool Execution**
   - `packages/core/src/tools/tool.ts:205` - originalExecute call

4. **Loop Workflow Tool Call**
   - `packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts:125` - tool.execute call

5. **LLM Execution Step**
   - `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts:534` - execute call

## Benefits of This Design

1. **Clean Separation of Concerns**
   - OTEL completely isolated in bridge package
   - Core only uses abstract interfaces
   - No OTEL imports leak into core

2. **Minimal Boilerplate**
   - Single helper function at call sites
   - No parameter soup
   - No if/then/else duplication

3. **Type Safe**
   - Full TypeScript support
   - Optional chaining handles undefined gracefully
   - No runtime errors from missing context

4. **Encapsulated Context**
   - Span owns its execution context
   - No need to pass observability/requestContext everywhere
   - Natural API: `span.executeInContext(fn)`

5. **Backwards Compatible**
   - Falls back gracefully when no bridge exists
   - Works with or without OTEL infrastructure
   - Doesn't break existing code

6. **Flexible Configuration**
   - Supports bridge-per-config architecture
   - Enables environment-specific OTEL integration
   - Allows sophisticated routing logic

## Testing Plan

### Unit Tests

1. **OtelBridge.executeInContext**
   - Test with valid span ID → wraps with OTEL context
   - Test with invalid span ID → executes without wrapping
   - Test context propagation through nested calls

2. **Span.executeInContext**
   - Test with bridge available → delegates to bridge
   - Test without bridge → executes directly
   - Test without observability → executes directly

3. **executeWithContext helper**
   - Test with span in context → uses span.executeInContext
   - Test without span → executes directly
   - Test with undefined tracingContext → executes directly

### Integration Tests

1. **Model Generation**
   - Verify HTTP requests nest under MODEL_GENERATION span
   - Verify DNS/TLS spans appear as children
   - Verify trace IDs propagate correctly

2. **Tool Execution**
   - Verify tool operations nest under TOOL_CALL span
   - Verify database queries get correct parent
   - Verify HTTP calls from tools properly nested

3. **Multi-Config Scenarios**
   - Verify different configs can have different bridges
   - Verify config selection works correctly
   - Verify bridge-per-config isolation

## Migration Path

### Phase 1: Core Infrastructure

1. Add `executeInContext` to ObservabilityBridge interface
2. Implement in OtelBridge
3. Add `executeInContext` to Span interface
4. Implement in Span class (ensure observability/requestContext access)
5. Add `executeWithContext` helper to utils

### Phase 2: Model Instrumentation

1. Instrument Model V1 generateText (line 254)
2. Instrument Model V1 streamText (line 608)
3. Test with example app
4. Verify span hierarchy in Jaeger

### Phase 3: Tool Instrumentation

1. Instrument tool.ts execute (line 205)
2. Instrument tool-call-step.ts (line 125)
3. Test with tools that make HTTP/DB calls

### Phase 4: Workflow Instrumentation

1. Instrument llm-execution-step.ts (line 534)
2. Instrument other workflow steps as needed
3. Test complete workflow traces

### Phase 5: Documentation

1. Update API documentation
2. Add examples to docs
3. Create migration guide for custom bridges

## Future Enhancements

1. **Automatic Instrumentation**
   - Decorator pattern for automatic wrapping
   - AOP-style instrumentation

2. **Performance Monitoring**
   - Track execution time with/without context
   - Monitor overhead of context propagation

3. **Enhanced Debugging**
   - Log when context is/isn't available
   - Warn when operations happen outside context

4. **Additional Context Types**
   - Support for baggage propagation
   - Support for custom context attributes
   - Integration with other tracing systems

## References

- [OpenTelemetry Context API](https://opentelemetry.io/docs/languages/js/context/)
- [Mastra Observability Architecture](../packages/core/src/observability/)
- [OTEL Bridge Implementation](../observability/otel-bridge/src/bridge.ts)
- [Original Context Propagation Doc](./otel-bridge-context-propagation.md)
