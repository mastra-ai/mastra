Excellent! Now I have the full picture. Let me create a comprehensive plan:

Implementation Plan: Bidirectional OtelBridge

Current State

✅ Read Context FROM OTEL - Implemented via getCurrentContext()❌ Export Mastra Spans TO OTEL - Stubbed in \_exportTracingEvent()

Key Discovery

The observability/otel-exporter package already has:

- SpanConverter - Converts Mastra spans to OTEL-compatible format
- MastraReadableSpan - OTEL ReadableSpan that preserves Mastra's traceId/spanId

Implementation Strategy

⏺ Here's my implementation plan:

Phase 1: Span Export Implementation

1.1 Key Difference from otel-exporter:

- otel-exporter: Creates standalone BatchSpanProcessor + exporter (for sending to external OTEL collector)
- otel-bridge: Uses the active OTEL TracerProvider (user's existing OTEL SDK setup)

This is important because:

- The bridge should export Mastra spans through the same OTEL pipeline the user already configured
- Spans will automatically go to whatever backend the user set up (Jaeger, Honeycomb, etc.)
- No additional configuration needed - just piggyback on existing OTEL setup

  1.2 Implementation Steps:

Step 1: Add dependency on @mastra/otel-exporter

- Import SpanConverter (reuse conversion logic)
- Import MastraReadableSpan (OTEL-compatible span format)

Step 2: Implement \_exportTracingEvent method:
protected async \_exportTracingEvent(event: TracingEvent): Promise<void> {
// Only export completed spans
if (event.type !== TracingEventType.SPAN_ENDED) return;

    // 1. Convert Mastra span to OTEL ReadableSpan
    const readableSpan = this.spanConverter.convertSpan(event.exportedSpan);

    // 2. Get active OTEL TracerProvider
    const provider = trace.getTracerProvider();

    // 3. Get the processor and export
    const processor = provider.getActiveSpanProcessor();
    processor.onEnd(readableSpan);

}

Step 3: Handle edge cases:

- No active TracerProvider → Log warning
- NoopTracerProvider → Skip silently
- TracerProvider without processor → Skip with warning

  1.3 Architecture:

Incoming HTTP Request with traceparent header
↓
OTEL Auto-Instrumentation captures request
↓
AsyncLocalStorage stores OTEL context
↓
Your Route Handler executes
↓
Mastra Agent.generate() called
↓
┌─────────────────────────────────────┐
│ OtelBridge (Bidirectional) │
├─────────────────────────────────────┤
│ 1. getCurrentContext() │ ← Read OTEL context
│ └─ Extract traceId/parentSpanId │ from AsyncLocalStorage
│ │
│ 2. Mastra creates spans with │
│ inherited traceId │
│ │
│ 3. exportTracingEvent() │ ← Export Mastra spans
│ └─ Convert to OTEL format │ back to OTEL
│ └─ Send to active TracerProvider │
└─────────────────────────────────────┘
↓
OTEL SDK's BatchSpanProcessor
↓
OTEL Exporter (Jaeger, Honeycomb, etc.)
↓
Observability Backend shows complete trace: - HTTP span (from OTEL auto-instrumentation) - Mastra agent span (child) - LLM call span (grandchild) - Tool call spans (grandchildren)

Phase 2: Testing & Validation

1. Integration Test: Verify spans appear in OTEL with correct parent-child relationships
2. Test Scenarios:


    - Request with traceparent header → Mastra spans inherit traceId
    - Request without header → Mastra creates new trace
    - Verify spans appear in memory exporter

Phase 3: Documentation

Update README to explain:

- How to verify bidirectional flow is working
- How to view traces in OTEL backends
- Troubleshooting tips
