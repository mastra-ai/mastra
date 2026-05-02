---
'@mastra/observability': minor
---

You can now track when `DefaultExporter` drops observability data because storage cannot accept it or retrying fails. Add `onDroppedEvent` to a custom exporter or bridge to forward dropped events to alerting or metrics.

```typescript
class DropCounterExporter extends BaseExporter {
  name = 'drop-counter';

  onDroppedEvent(event: ObservabilityDropEvent) {
    metricsCounter.add(event.count, {
      reason: event.reason,
      signal: event.signal,
    });
  }

  protected async _exportTracingEvent() {}
}
```
