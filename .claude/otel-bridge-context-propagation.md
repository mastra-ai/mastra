# OTEL Bridge Context Propagation - Implementation Guide

## Current Status

The OtelBridge (`observability/otel-bridge/src/bridge.ts`) creates real OTEL spans synchronized with Mastra span lifecycle:

1. **SPAN_STARTED**: Creates OTEL span via `tracer.startSpan()`, stores span context
2. **SPAN_ENDED**: Sets all attributes, status, input/output, then ends the span

The bridge provides `getSpanContext(spanId): Context | undefined` to retrieve OTEL contexts for Mastra spans.

## Future Work: Tool/Workflow Context Propagation

To enable proper parent-child relationships for OTEL-instrumented operations (DB calls, HTTP requests) within Mastra tools and workflows, Mastra core needs to:

### 1. Execute User Code Within OTEL Context

When executing tool functions, workflow steps, or workflow conditions, wrap execution with the OTEL context:

```typescript
// In tool execution (packages/core/src/tools/)
const bridge = observabilityInstance.getBridge();
if (bridge && typeof bridge.getSpanContext === 'function') {
  const spanContext = bridge.getSpanContext(currentSpan.id);
  if (spanContext) {
    // Execute tool within OTEL context
    return await otelContext.with(spanContext, () => {
      return toolFunction(args);
    });
  }
}

// Fallback: execute without OTEL context
return await toolFunction(args);
```

### 2. Span Types That Need Context Propagation

Update these execution points in `packages/core/src/`:

- **tool_call** (`tools/`) - Tool function execution
- **workflow_step** (`workflows/`) - Workflow step execution
- **workflow_condition** (`workflows/`) - Condition evaluation
- **agent_generate** (`agent/`) - Agent generation (for nested agent calls)
- **mcp_tool_call** (`tools/`) - MCP tool execution
- Any other span type where user code executes

### 3. Type Safety

Add optional method to ObservabilityBridge interface:

```typescript
// packages/core/src/observability/types/tracing.ts
export interface ObservabilityBridge {
  // ... existing methods ...

  /**
   * Get OTEL context for a specific Mastra span
   * Used by Mastra core to execute user code within OTEL span context
   */
  getSpanContext?(spanId: string): Context | undefined;
}
```

### 4. Benefits

With context propagation, this hierarchy becomes possible:

```
HTTP Request (OTEL auto-instrumentation)
  └─ Agent Execution (Mastra → OTEL Bridge)
      └─ Tool Call (Mastra → OTEL Bridge)
          └─ Database Query (OTEL auto-instrumentation)
              - Automatically has tool call as parent ✓
```

Without context propagation, DB queries would be orphaned or incorrectly parented.

## Testing

Integration tests at `observability/otel-bridge/src/integration.test.ts` verify:

- Context extraction from active OTEL spans
- Mastra spans exported to OTEL with correct attributes
- Parent-child relationships maintained
- Trace IDs properly propagated

## References

- OpenTelemetry Context API: https://opentelemetry.io/docs/languages/js/context/
- Mastra Observability: `packages/core/src/observability/`
- OTEL Bridge Implementation: `observability/otel-bridge/src/bridge.ts`
