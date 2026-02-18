# PR 2.2: JsonExporter Updates

**Package:** `observability/mastra`
**Scope:** Update JsonExporter to support all signals (T/M/L/S/F)

---

## 2.2.1 Update JsonExporter

**File:** `observability/mastra/src/exporters/json.ts` (modify)

```typescript
export class JsonExporter extends BaseExporter {
  readonly name = 'JsonExporter';
  // Handler presence = signal support
  // Implements all handlers for debugging purposes

  async onTracingEvent(event: TracingEvent): Promise<void> {
    // event.span is AnyExportedSpan (JSON-safe)
    this.output('trace', event);
  }

  async onMetricEvent(event: MetricEvent): Promise<void> {
    // event.metric is ExportedMetric (JSON-safe)
    this.output('metric', event);
  }

  async onLogEvent(event: LogEvent): Promise<void> {
    // event.log is ExportedLog (JSON-safe)
    this.output('log', event);
  }

  async onScoreEvent(event: ScoreEvent): Promise<void> {
    // event.score is ExportedScore (JSON-safe)
    this.output('score', event);
  }

  async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
    // event.feedback is ExportedFeedback (JSON-safe)
    this.output('feedback', event);
  }

  private output(type: string, data: unknown): void {
    // Output to console or file based on config
    // Exported types are already JSON-safe, so this just works
    console.log(JSON.stringify({ type, timestamp: new Date().toISOString(), data }, null, 2));
  }
}
```

**Tasks:**
- [ ] Implement `onTracingEvent()` handler (update existing)
- [ ] Implement `onMetricEvent()` handler
- [ ] Implement `onLogEvent()` handler
- [ ] Implement `onScoreEvent()` handler
- [ ] Implement `onFeedbackEvent()` handler
- [ ] Support console and file output

---

## 2.2.2 JSON → RecordedTrace Factory

**File:** `observability/mastra/src/traces/recorded-trace-factory.ts` (new)

The JsonExporter outputs serialized span data. To support round-tripping (and testing), provide factory methods to reconstruct a `RecordedTrace` from JSON:

```typescript
import type { RecordedTrace, SpanData, AnySpanData } from '@mastra/core';
import { ObservabilityBus } from '../bus/observability';
import { RecordedSpanImpl } from '../spans/recorded-span';
import { RecordedTraceImpl } from './recorded-trace';

/**
 * Create a RecordedTrace from a JSON string (e.g., JsonExporter output).
 */
export function createRecordedTraceFromJSON(
  json: string,
  bus: ObservabilityBus,
): RecordedTrace {
  const spanDataArray: AnySpanData[] = JSON.parse(json);
  return createRecordedTraceFromSpans(spanDataArray, bus);
}

/**
 * Create a RecordedTrace from an array of span data.
 */
export function createRecordedTraceFromSpans(
  spanDataArray: AnySpanData[],
  bus: ObservabilityBus,
): RecordedTrace {
  if (spanDataArray.length === 0) {
    throw new Error('Cannot create RecordedTrace from empty span array');
  }

  // 1. Create RecordedSpan objects
  const spanMap = new Map<string, RecordedSpanImpl>();
  for (const data of spanDataArray) {
    spanMap.set(data.id, new RecordedSpanImpl(data, bus));
  }

  // 2. Wire up parent/children references
  for (const span of spanMap.values()) {
    if (span.parentSpanId) {
      const parent = spanMap.get(span.parentSpanId);
      if (parent) {
        span._setParent(parent);
        parent._addChild(span);
      }
    }
  }

  // 3. Find root span
  const rootSpan = [...spanMap.values()].find(s => !s.parent);
  if (!rootSpan) {
    throw new Error(`No root span found in trace`);
  }

  // 4. Extract traceId and build flat array
  const traceId = rootSpan.traceId;
  const spans = [...spanMap.values()];

  return new RecordedTraceImpl(traceId, rootSpan, spans, spanMap, bus);
}
```

**Use cases:**
- Testing: Create traces from JSON fixtures
- Debugging: Load traces from JsonExporter output
- Import: Cross-system trace transfer

**Tasks:**
- [ ] Implement `createRecordedTraceFromJSON()` factory
- [ ] Implement `createRecordedTraceFromSpans()` factory
- [ ] Build tree structure from parentSpanId references
- [ ] Handle edge cases (empty array, no root span)

---

## PR 2.2 Testing

**Tasks:**
- [ ] Test all event types output correctly
- [ ] Verify JSON serialization works (Exported types are JSON-safe)
- [ ] Test file output mode
- [ ] Test `createRecordedTraceFromJSON()` round-trips correctly
- [ ] Test `createRecordedTraceFromSpans()` builds correct tree structure
- [ ] Test tree + flat access reference same span objects
