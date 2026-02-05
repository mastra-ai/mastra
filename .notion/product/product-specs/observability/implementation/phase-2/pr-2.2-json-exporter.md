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

## PR 2.2 Testing

**Tasks:**
- [ ] Test all event types output correctly
- [ ] Verify JSON serialization works (Exported types are JSON-safe)
- [ ] Test file output mode
