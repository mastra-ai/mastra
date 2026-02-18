# PR 6.1: DefaultExporter

**Package:** `@mastra/observability`
**Scope:** DefaultExporter that converts Exported → Record types and writes to storage

---

## 6.1.1 DefaultExporter Implementation

**File:** `observability/mastra/src/exporters/default.ts` (new)

```typescript
import {
  BaseExporter,
  TracingEvent,
  LogEvent,
  MetricEvent,
  ScoreEvent,
  FeedbackEvent,
} from '@mastra/observability';
import { ObservabilityStorage } from '@mastra/core';

export interface DefaultExporterConfig {
  storage: ObservabilityStorage;
  batchSize?: number;
  flushIntervalMs?: number;
}

export class DefaultExporter extends BaseExporter {
  readonly name = 'DefaultExporter';

  private storage: ObservabilityStorage;

  constructor(config: DefaultExporterConfig) {
    super();
    this.storage = config.storage;
    // Initialize batching if configured
  }

  async onTracingEvent(event: TracingEvent): Promise<void> {
    // Convert AnyExportedSpan → SpanRecord
    const record = this.convertToSpanRecord(event.span);
    await this.storage.batchCreateSpans({ records: [record] });
  }

  async onLogEvent(event: LogEvent): Promise<void> {
    // Convert ExportedLog → LogRecord
    const record = this.convertToLogRecord(event.log);
    await this.storage.batchCreateLogs({ logs: [record] });
  }

  async onMetricEvent(event: MetricEvent): Promise<void> {
    // Convert ExportedMetric → MetricRecord
    const record = this.convertToMetricRecord(event.metric);
    await this.storage.batchRecordMetrics({ metrics: [record] });
  }

  async onScoreEvent(event: ScoreEvent): Promise<void> {
    // Convert ExportedScore → ScoreRecord
    const record = this.convertToScoreRecord(event.score);
    await this.storage.createScore({ score: record });
  }

  async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
    // Convert ExportedFeedback → FeedbackRecord
    const record = this.convertToFeedbackRecord(event.feedback);
    await this.storage.createFeedback({ feedback: record });
  }

  // Conversion methods (Exported → Record)
  private convertToSpanRecord(span: AnyExportedSpan): CreateSpanRecord {
    return {
      ...span,
      // Add id if not present
    };
  }

  private convertToLogRecord(log: ExportedLog): CreateLogRecord {
    return {
      id: generateId(),
      ...log,
    };
  }

  private convertToMetricRecord(metric: ExportedMetric): CreateMetricRecord {
    return {
      id: generateId(),
      ...metric,
    };
  }

  private convertToScoreRecord(score: ExportedScore): CreateScoreRecord {
    return {
      id: generateId(),
      ...score,
    };
  }

  private convertToFeedbackRecord(feedback: ExportedFeedback): CreateFeedbackRecord {
    return {
      id: generateId(),
      ...feedback,
    };
  }
}
```

**Tasks:**
- [ ] Implement DefaultExporter class
- [ ] Implement all signal handlers
- [ ] Implement Exported → Record conversion for each signal
- [ ] Add batching support for high-volume signals
- [ ] Add flush interval configuration
- [ ] Export from package index

---

## 6.1.2 Batching Strategy

For high-volume signals (traces, logs, metrics), implement batching:

```typescript
interface BatchConfig {
  maxSize: number;       // Max items before flush
  maxWaitMs: number;     // Max time before flush
}

class SignalBatcher<T> {
  private buffer: T[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private config: BatchConfig,
    private flush: (items: T[]) => Promise<void>
  ) {}

  add(item: T): void {
    this.buffer.push(item);
    if (this.buffer.length >= this.config.maxSize) {
      this.flushNow();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flushNow(), this.config.maxWaitMs);
    }
  }

  async flushNow(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.buffer.length > 0) {
      const items = this.buffer;
      this.buffer = [];
      await this.flush(items);
    }
  }
}
```

**Tasks:**
- [ ] Implement SignalBatcher utility
- [ ] Use batchers for traces, logs, metrics
- [ ] Scores and feedback can be unbatched (lower volume)

---

## PR 6.1 Testing

**Tasks:**
- [ ] Test DefaultExporter receives all event types
- [ ] Test Exported → Record conversion is correct
- [ ] Test batching flushes at max size
- [ ] Test batching flushes at max wait time
- [ ] Test flush() drains all batches
- [ ] Test shutdown() completes pending writes
