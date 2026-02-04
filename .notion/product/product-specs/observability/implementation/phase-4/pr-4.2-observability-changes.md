## PR 4.2: @mastra/observability Changes

**Package:** `observability/mastra`
**Scope:** Span/Trace implementations, score/feedback emission, exporter updates

**Note:** The `ObservabilityBus` was created in Phase 1 and already handles all event types (TracingEvent, MetricEvent, LogEvent). This phase adds ScoreEvent and FeedbackEvent to the existing bus.

### 4.2.1 Update Span Implementation

**File:** `observability/mastra/src/spans/span.ts` (modify)

```typescript
import { Span, ScoreInput, FeedbackInput, ScoreEvent, FeedbackEvent } from '@mastra/core';
import { ObservabilityBus } from '../bus/observability';

export class SpanImpl implements Span {
  constructor(
    private data: SpanData,
    private bus: ObservabilityBus,
  ) {}

  // Existing properties and methods...

  addScore(score: ScoreInput): void {
    const event: ScoreEvent = {
      type: 'score',
      traceId: this.traceId,
      spanId: this.spanId,
      score,
      timestamp: new Date(),
    };
    this.bus.emit(event);
  }

  addFeedback(feedback: FeedbackInput): void {
    const event: FeedbackEvent = {
      type: 'feedback',
      traceId: this.traceId,
      spanId: this.spanId,
      feedback,
      timestamp: new Date(),
    };
    this.bus.emit(event);
  }
}
```

**Tasks:**
- [ ] Implement `addScore()` on SpanImpl
- [ ] Implement `addFeedback()` on SpanImpl
- [ ] Emit ScoreEvent/FeedbackEvent via ObservabilityBus

### 4.2.2 Update NoOp Span

**File:** `observability/mastra/src/spans/no-op.ts` (modify)

```typescript
export const noOpSpan: Span = {
  // Existing no-op implementations...

  addScore(score: ScoreInput): void {
    // No-op
  },

  addFeedback(feedback: FeedbackInput): void {
    // No-op
  },
};
```

**Tasks:**
- [ ] Add no-op `addScore()` and `addFeedback()`

### 4.2.3 Implement Trace Class

**File:** `observability/mastra/src/traces/trace.ts` (new)

```typescript
import { Trace, Span, ScoreInput, FeedbackInput, ScoreEvent, FeedbackEvent } from '@mastra/core';
import { ObservabilityBus } from '../bus/observability';

export class TraceImpl implements Trace {
  constructor(
    public readonly traceId: string,
    private _spans: Map<string, Span>,
    private bus: ObservabilityBus,
  ) {}

  get spans(): ReadonlyArray<Span> {
    return Array.from(this._spans.values());
  }

  getSpan(spanId: string): Span | null {
    return this._spans.get(spanId) ?? null;
  }

  addScore(score: ScoreInput): void {
    // Score at trace level (no spanId)
    const event: ScoreEvent = {
      type: 'score',
      traceId: this.traceId,
      spanId: undefined,
      score,
      timestamp: new Date(),
    };
    this.bus.emit(event);
  }

  addFeedback(feedback: FeedbackInput): void {
    // Feedback at trace level (no spanId)
    const event: FeedbackEvent = {
      type: 'feedback',
      traceId: this.traceId,
      spanId: undefined,
      feedback,
      timestamp: new Date(),
    };
    this.bus.emit(event);
  }
}
```

**Tasks:**
- [ ] Implement TraceImpl class
- [ ] Support trace-level scores (no spanId)
- [ ] Support trace-level feedback (no spanId)
- [ ] Implement getSpan()

### 4.2.4 Implement Mastra.getTrace()

**File:** `observability/mastra/src/instances/base.ts` (modify)

```typescript
async getTrace(traceId: string): Promise<Trace | null> {
  if (!this.storage) {
    return null;
  }

  // Fetch all spans for the trace
  const result = await this.storage.listTraces({
    filters: { traceId },
    pagination: { limit: 1000 },  // Reasonable max spans per trace
  });

  if (result.data.length === 0) {
    return null;
  }

  // Build span map
  const spanMap = new Map<string, Span>();
  for (const spanData of result.data) {
    const span = this.createSpanFromRecord(spanData);
    spanMap.set(spanData.id, span);
  }

  return new TraceImpl(traceId, spanMap, this.observabilityBus);
}

private createSpanFromRecord(record: SpanRecord): Span {
  // Create a "historical" span that can still emit events
  return new HistoricalSpanImpl(record, this.observabilityBus);
}
```

**Tasks:**
- [ ] Implement getTrace() on BaseObservabilityInstance
- [ ] Fetch spans from storage
- [ ] Build TraceImpl with spans

### 4.2.5 Historical Span Implementation

**File:** `observability/mastra/src/spans/historical.ts` (new)

```typescript
import { Span, ScoreInput, FeedbackInput, SpanRecord, ScoreEvent, FeedbackEvent } from '@mastra/core';
import { ObservabilityBus } from '../bus/observability';

/**
 * A span loaded from storage that can still receive scores/feedback
 * but cannot be modified (already ended).
 */
export class HistoricalSpanImpl implements Span {
  constructor(
    private record: SpanRecord,
    private bus: ObservabilityBus,
  ) {}

  get traceId(): string { return this.record.traceId; }
  get spanId(): string { return this.record.id; }
  get name(): string { return this.record.name; }

  // Status methods throw - span already ended
  setStatus(): void {
    throw new Error('Cannot modify historical span');
  }

  setAttribute(): void {
    throw new Error('Cannot modify historical span');
  }

  addEvent(): void {
    throw new Error('Cannot modify historical span');
  }

  end(): void {
    throw new Error('Historical span already ended');
  }

  // Score/Feedback work on historical spans
  addScore(score: ScoreInput): void {
    const event: ScoreEvent = {
      type: 'score',
      traceId: this.traceId,
      spanId: this.spanId,
      score,
      timestamp: new Date(),
    };
    this.bus.emit(event);
  }

  addFeedback(feedback: FeedbackInput): void {
    const event: FeedbackEvent = {
      type: 'feedback',
      traceId: this.traceId,
      spanId: this.spanId,
      feedback,
      timestamp: new Date(),
    };
    this.bus.emit(event);
  }
}
```

**Tasks:**
- [ ] Implement HistoricalSpanImpl
- [ ] Throw on modification methods
- [ ] Allow addScore/addFeedback

### 4.2.6 Update DefaultExporter

**File:** `observability/mastra/src/exporters/default.ts` (modify)

```typescript
export class DefaultExporter extends BaseExporter {
  // Handler presence = signal support (no flags needed)

  async onTracingEvent(event: TracingEvent): Promise<void> {
    // Handle span events only (span.started, span.updated, span.ended, span.error)
    // Existing span handling...
  }

  // NEW: Separate handler for score events
  async onScoreEvent(event: ScoreEvent): Promise<void> {
    if (!this.storage) return;

    const record: ScoreRecord = {
      id: generateId(),
      timestamp: event.timestamp,
      traceId: event.traceId,
      spanId: event.spanId,
      scorerName: event.score.scorerName,
      score: event.score.score,
      reason: event.score.reason,
      metadata: event.score.metadata,
      experiment: event.score.experiment,
      organizationId: this.config.organizationId,
      environment: this.config.environment,
      serviceName: this.config.serviceName,
    };

    await this.storage.createScore({ score: record });
  }

  // NEW: Separate handler for feedback events
  async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
    if (!this.storage) return;

    const record: FeedbackRecord = {
      id: generateId(),
      timestamp: event.timestamp,
      traceId: event.traceId,
      spanId: event.spanId,
      source: event.feedback.source,
      feedbackType: event.feedback.feedbackType,
      value: event.feedback.value,
      comment: event.feedback.comment,
      experiment: event.feedback.experiment,
      userId: event.feedback.userId,
      metadata: event.feedback.metadata,
      organizationId: this.config.organizationId,
      environment: this.config.environment,
      serviceName: this.config.serviceName,
    };

    await this.storage.createFeedback({ feedback: record });
  }
}
```

**Tasks:**
- [ ] Implement `onScoreEvent()` handler
- [ ] Implement `onFeedbackEvent()` handler
- [ ] Write to storage

### 4.2.7 Update JsonExporter

**File:** `observability/mastra/src/exporters/json.ts` (modify)

```typescript
// Handler presence = signal support

async onTracingEvent(event: TracingEvent): Promise<void> {
  // Existing span output
  this.output('span', event.exportedSpan);
}

async onScoreEvent(event: ScoreEvent): Promise<void> {
  this.output('score', {
    traceId: event.traceId,
    spanId: event.spanId,
    timestamp: event.timestamp.toISOString(),
    ...event.score,
  });
}

async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
  this.output('feedback', {
    traceId: event.traceId,
    spanId: event.spanId,
    timestamp: event.timestamp.toISOString(),
    ...event.feedback,
  });
}
```

**Tasks:**
- [ ] Implement `onScoreEvent()` handler
- [ ] Implement `onFeedbackEvent()` handler

### 4.2.8 Update CloudExporter

**File:** `observability/cloud/src/exporter.ts` (if exists)

**Tasks:**
- [ ] Implement `onScoreEvent()` handler
- [ ] Implement `onFeedbackEvent()` handler
- [ ] Send to Mastra Cloud API

### PR 4.2 Testing

**Tasks:**
- [ ] Test span.addScore() emits event
- [ ] Test span.addFeedback() emits event
- [ ] Test trace.addScore() emits event (no spanId)
- [ ] Test trace.addFeedback() emits event (no spanId)
- [ ] Test mastra.getTrace() returns Trace with spans
- [ ] Test historical span allows scores/feedback
- [ ] Test historical span throws on modification
- [ ] Test DefaultExporter writes scores
- [ ] Test DefaultExporter writes feedback

