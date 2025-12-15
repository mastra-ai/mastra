# Investigation: Memory Leak in Mastra Observability (Issue #11169)

**Date**: 2025-12-15
**Issue**: https://github.com/mastra-ai/mastra/issues/11169
**Branch**: claude/investigate-observability-issue-Qe9NQ

## Summary

Users report a critical memory leak where Mastra holds ~1.1GB of strings in heap snapshots after agent runs complete. The memory is not garbage collected even 15 minutes after generation on idle. Disabling observability fixes the issue:

```typescript
observability: {
  default: {
    enabled: false
  }
}
```

## Identified Memory Retention Sources

### 1. DefaultExporter.allCreatedSpans (HIGH SEVERITY)

**Location**: `observability/mastra/src/exporters/default.ts:88`

```typescript
private allCreatedSpans: Set<string> = new Set();
```

**Problem**:
- This Set persists span keys (`${traceId}:${spanId}`) across batch flushes
- Only cleaned up when spans receive `SPAN_ENDED` events AND flush succeeds (lines 581-584)
- If spans never end, this Set grows indefinitely

**Evidence**:
- Line 204: Added on `SPAN_STARTED`
- Line 246: Added on `SPAN_ENDED` for event spans
- Lines 309-311: Only deleted after successful flush for completed spans

### 2. In-Memory Storage Collection (HIGH SEVERITY)

**Location**: `packages/core/src/storage/domains/observability/inmemory.ts:17`

```typescript
collection: InMemoryObservability; // Map<string, SpanRecord>
```

**Problem**:
- Stores ALL spans with no automatic cleanup mechanism
- No TTL (time-to-live)
- No size bounds
- Only cleaned via manual `batchDeleteTraces()` call (lines 173-180)

### 3. Exporter Trace Maps (MEDIUM SEVERITY)

**Affected Files**:
- `observability/langfuse/src/tracing.ts:103`
- `observability/posthog/src/tracing.ts:91`
- `observability/langsmith/src/tracing.ts:58`
- `observability/braintrust/src/tracing.ts:66`
- `observability/otel-bridge/src/bridge.ts:64`

**Problem**:
- Each exporter maintains its own trace map with nested Maps and Sets
- Cleanup only occurs when ALL spans for a trace end
- If ANY span doesn't end properly, ENTIRE trace data is retained

**Example (Langfuse)**:
```typescript
type TraceData = {
  trace: LangfuseTraceClient;
  spans: Map<string, LangfuseSpanClient | LangfuseGenerationClient>;
  spanMetadata: Map<string, SpanMetadata>;
  events: Map<string, LangfuseEventClient>;
  activeSpans: Set<string>;
  rootSpanId?: string;
};
private traceMap = new Map<string, TraceData>();
```

### 4. Span Parent References (MEDIUM SEVERITY)

**Location**: `observability/mastra/src/spans/base.ts:111, 137`

```typescript
public parent?: AnySpan;
// ...
this.parent = options.parent;
```

**Problem**:
- Each span holds a reference to its parent span
- Creates a chain of references preventing GC of ancestor spans
- Also holds reference to `observabilityInstance` (line 139)

### 5. ModelSpanTracker Data (MEDIUM SEVERITY)

**Location**: `observability/mastra/src/model-tracing.ts:51-53`

```typescript
#toolOutputAccumulators: Map<string, ToolOutputAccumulator> = new Map();
#streamedToolCallIds: Set<string> = new Set();
```

**Problem**:
- Holds temporary data during streaming
- Only cleaned up when proper finish events occur
- If streams error mid-way, data accumulates

### 6. OtelBridge Span Map (MEDIUM SEVERITY)

**Location**: `observability/otel-bridge/src/bridge.ts:64`

```typescript
private otelSpanMap = new Map<string, { otelSpan: OtelSpan; otelContext: OtelContext }>();
```

**Problem**:
- Stores OTEL spans keyed by span ID
- Only cleaned when `handleSpanEnded` is called (line 171)
- Orphaned spans remain indefinitely

## Root Cause Analysis

The observability system relies on spans being properly ended via `SPAN_ENDED` events to clean up memory. However, several scenarios can cause spans to never end:

1. **Streaming errors**: If a stream errors mid-way, the `onFinish` callback may never be called
2. **User code errors**: Exceptions in user code before `span.end()` is called
3. **Long-running operations**: Operations that hang or timeout
4. **Silent failures**: Edge cases where span.end() isn't called

### Why Disabling Observability Fixes It

When `observability.default.enabled = false`:
- No spans are created → no entries in `allCreatedSpans`
- No span records stored → no entries in storage
- No trace maps populated → no memory in exporters

## Scenarios That May Cause Span Leaks

1. **Agent runs with ~30 steps and dozen tool calls** (as reported)
   - Each tool call creates a span
   - Each model generation creates spans
   - If any span doesn't complete, memory accumulates

2. **Streaming interruption**
   - User cancels mid-stream
   - Network timeout
   - Error in stream processing

3. **Error during span lifecycle**
   - Error before `span.end()` call
   - Error in span processor
   - Error in exporter

## Recommended Fixes

### Short-term (Immediate Relief)

1. **Add TTL-based cleanup to DefaultExporter.allCreatedSpans**
   ```typescript
   // Clean up spans older than X minutes
   private cleanupOldSpans(maxAgeMs: number = 5 * 60 * 1000): void {
     // Implementation needed - may require storing timestamps
   }
   ```

2. **Add size bounds to in-memory storage**
   ```typescript
   // Evict oldest entries when size exceeds limit
   private maxSpans = 10000;
   ```

### Medium-term (Proper Fix)

3. **Add span timeout mechanism**
   - Auto-end spans after configurable duration
   - Log warning when auto-ending

4. **Break parent span references after span ends**
   ```typescript
   end(options?: EndSpanOptions<TType>): void {
     // ... existing code ...
     this.parent = undefined; // Allow GC of parent chain
   }
   ```

5. **Add periodic cleanup to trace maps**
   - Background task that cleans orphaned traces
   - Configurable retention period

### Long-term (Architectural)

6. **Consider WeakMap/WeakRef where possible**
   - Use WeakRef for parent span references
   - Allows GC while maintaining functionality

7. **Add memory monitoring and alerts**
   - Track observability memory usage
   - Emit warnings when approaching limits

## Files to Review for Implementation

- `observability/mastra/src/exporters/default.ts` - Main exporter with allCreatedSpans
- `packages/core/src/storage/domains/observability/inmemory.ts` - In-memory storage
- `observability/mastra/src/spans/base.ts` - Base span class
- `observability/mastra/src/instances/base.ts` - Observability lifecycle
- All exporter files for trace map cleanup

## Testing Recommendations

1. Create test that simulates high-volume agent runs
2. Add memory profiling tests
3. Test span cleanup after errors
4. Test cleanup of interrupted streams
5. Verify GC behavior after proper shutdown
