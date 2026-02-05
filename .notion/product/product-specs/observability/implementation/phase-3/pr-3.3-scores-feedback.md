# PR 3.3: Scores & Feedback Implementation

**Package:** `observability/mastra`
**Scope:** Span/Trace score/feedback APIs, historical spans, exporter updates

**Note:** The `ObservabilityBus` was created in Phase 1 and already handles ScoreEvent and FeedbackEvent types.

---

## 3.3.1 Update Span Implementation

**File:** `observability/mastra/src/spans/span.ts` (modify)

```typescript
import type { Span, ScoreInput, FeedbackInput, ExportedScore, ExportedFeedback, ScoreEvent, FeedbackEvent } from '@mastra/core';
import { ObservabilityBus } from '../bus/observability';

export class SpanImpl implements Span {
  constructor(
    private data: SpanData,
    private bus: ObservabilityBus,
  ) {}

  // Existing properties and methods...

  addScore(score: ScoreInput): void {
    const exportedScore: ExportedScore = {
      timestamp: new Date(),
      traceId: this.traceId,
      spanId: this.spanId,
      scorerName: score.scorerName,
      score: score.score,
      reason: score.reason,
      experiment: score.experiment,
      metadata: {
        ...this.data.metadata,
        ...score.metadata,
      },
    };

    const event: ScoreEvent = { type: 'score', score: exportedScore };
    this.bus.emit(event);
  }

  addFeedback(feedback: FeedbackInput): void {
    const exportedFeedback: ExportedFeedback = {
      timestamp: new Date(),
      traceId: this.traceId,
      spanId: this.spanId,
      source: feedback.source,
      feedbackType: feedback.feedbackType,
      value: feedback.value,
      comment: feedback.comment,
      experiment: feedback.experiment,
      metadata: {
        ...this.data.metadata,
        userId: feedback.userId,
        ...feedback.metadata,
      },
    };

    const event: FeedbackEvent = { type: 'feedback', feedback: exportedFeedback };
    this.bus.emit(event);
  }
}
```

**Notes:**
- The span's `metadata` already contains context (organizationId, userId, environment, etc.)
- We merge with score/feedback-specific metadata to preserve any additional fields

**Tasks:**
- [ ] Implement `addScore()` on SpanImpl
- [ ] Implement `addFeedback()` on SpanImpl
- [ ] Use span's existing metadata (already has context)
- [ ] Emit ScoreEvent/FeedbackEvent via ObservabilityBus

---

## 3.3.2 Update NoOp Span

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

---

## 3.3.3 Implement Trace Class

**File:** `observability/mastra/src/traces/trace.ts` (new)

```typescript
import type { Trace, Span, ScoreInput, FeedbackInput, ExportedScore, ExportedFeedback, ScoreEvent, FeedbackEvent } from '@mastra/core';
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

  private getRootMetadata(): Record<string, unknown> | undefined {
    for (const span of this._spans.values()) {
      if (span.isRootSpan) {
        return span.metadata;
      }
    }
    return undefined;
  }

  addScore(score: ScoreInput): void {
    const exportedScore: ExportedScore = {
      timestamp: new Date(),
      traceId: this.traceId,
      spanId: undefined,
      scorerName: score.scorerName,
      score: score.score,
      reason: score.reason,
      experiment: score.experiment,
      metadata: {
        ...this.getRootMetadata(),
        ...score.metadata,
      },
    };

    const event: ScoreEvent = { type: 'score', score: exportedScore };
    this.bus.emit(event);
  }

  addFeedback(feedback: FeedbackInput): void {
    const exportedFeedback: ExportedFeedback = {
      timestamp: new Date(),
      traceId: this.traceId,
      spanId: undefined,
      source: feedback.source,
      feedbackType: feedback.feedbackType,
      value: feedback.value,
      comment: feedback.comment,
      experiment: feedback.experiment,
      metadata: {
        ...this.getRootMetadata(),
        userId: feedback.userId,
        ...feedback.metadata,
      },
    };

    const event: FeedbackEvent = { type: 'feedback', feedback: exportedFeedback };
    this.bus.emit(event);
  }
}
```

**Notes:**
- For trace-level scores/feedback, use the root span's metadata for context
- This preserves the context that was captured when the trace started

**Tasks:**
- [ ] Implement TraceImpl class
- [ ] Support trace-level scores (no spanId)
- [ ] Support trace-level feedback (no spanId)
- [ ] Use root span's metadata for context
- [ ] Implement getSpan()

---

## 3.3.4 Implement Mastra.getTrace()

**File:** `observability/mastra/src/instances/base.ts` (modify)

```typescript
async getTrace(traceId: string): Promise<Trace | null> {
  if (!this.storage) {
    return null;
  }

  const result = await this.storage.listTraces({
    filters: { traceId },
    pagination: { limit: 1000 },
  });

  if (result.data.length === 0) {
    return null;
  }

  const spanMap = new Map<string, Span>();
  for (const spanData of result.data) {
    const span = new HistoricalSpanImpl(spanData, this.observabilityBus);
    spanMap.set(spanData.id, span);
  }

  return new TraceImpl(traceId, spanMap, this.observabilityBus);
}
```

**Tasks:**
- [ ] Implement getTrace() on BaseObservabilityInstance
- [ ] Fetch spans from storage
- [ ] Build TraceImpl with spans

---

## 3.3.5 Historical Span Implementation

**File:** `observability/mastra/src/spans/historical.ts` (new)

```typescript
import type { Span, ScoreInput, FeedbackInput, SpanRecord, ExportedScore, ExportedFeedback, ScoreEvent, FeedbackEvent } from '@mastra/core';
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
  get metadata(): Record<string, unknown> | undefined { return this.record.metadata; }
  get isRootSpan(): boolean { return !this.record.parentSpanId; }

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

  addScore(score: ScoreInput): void {
    const exportedScore: ExportedScore = {
      timestamp: new Date(),
      traceId: this.traceId,
      spanId: this.spanId,
      scorerName: score.scorerName,
      score: score.score,
      reason: score.reason,
      experiment: score.experiment,
      metadata: {
        ...this.record.metadata,
        ...score.metadata,
      },
    };

    const event: ScoreEvent = { type: 'score', score: exportedScore };
    this.bus.emit(event);
  }

  addFeedback(feedback: FeedbackInput): void {
    const exportedFeedback: ExportedFeedback = {
      timestamp: new Date(),
      traceId: this.traceId,
      spanId: this.spanId,
      source: feedback.source,
      feedbackType: feedback.feedbackType,
      value: feedback.value,
      comment: feedback.comment,
      experiment: feedback.experiment,
      metadata: {
        ...this.record.metadata,
        userId: feedback.userId,
        ...feedback.metadata,
      },
    };

    const event: FeedbackEvent = { type: 'feedback', feedback: exportedFeedback };
    this.bus.emit(event);
  }
}
```

**Tasks:**
- [ ] Implement HistoricalSpanImpl
- [ ] Throw on modification methods
- [ ] Allow addScore/addFeedback
- [ ] Use record's existing metadata

---

## 3.3.6 Update DefaultExporter

**File:** `observability/mastra/src/exporters/default.ts` (modify)

```typescript
async onScoreEvent(event: ScoreEvent): Promise<void> {
  if (!this.storage) return;

  const record: ScoreRecord = {
    id: generateId(),
    timestamp: event.score.timestamp,
    traceId: event.score.traceId,
    spanId: event.score.spanId,
    scorerName: event.score.scorerName,
    score: event.score.score,
    reason: event.score.reason,
    experiment: event.score.experiment,
    metadata: event.score.metadata,
  };

  await this.storage.createScore({ score: record });
}

async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
  if (!this.storage) return;

  const record: FeedbackRecord = {
    id: generateId(),
    timestamp: event.feedback.timestamp,
    traceId: event.feedback.traceId,
    spanId: event.feedback.spanId,
    source: event.feedback.source,
    feedbackType: event.feedback.feedbackType,
    value: event.feedback.value,
    comment: event.feedback.comment,
    experiment: event.feedback.experiment,
    metadata: event.feedback.metadata,
  };

  await this.storage.createFeedback({ feedback: record });
}
```

**Tasks:**
- [ ] Implement `onScoreEvent()` handler
- [ ] Implement `onFeedbackEvent()` handler
- [ ] Convert Exported → Record for storage

---

## 3.3.7 Update JsonExporter

**File:** `observability/mastra/src/exporters/json.ts` (modify)

```typescript
async onScoreEvent(event: ScoreEvent): Promise<void> {
  this.output('score', event.score);
}

async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
  this.output('feedback', event.feedback);
}
```

**Tasks:**
- [ ] Implement `onScoreEvent()` handler
- [ ] Implement `onFeedbackEvent()` handler

---

## 3.3.8 Update CloudExporter

**File:** `observability/cloud/src/exporter.ts` (if exists)

**Tasks:**
- [ ] Implement `onScoreEvent()` handler
- [ ] Implement `onFeedbackEvent()` handler
- [ ] Send to Mastra Cloud API

---

## PR 3.3 Testing

**Tasks:**
- [ ] Test span.addScore() includes span's metadata in event
- [ ] Test span.addFeedback() includes span's metadata in event
- [ ] Test trace.addScore() uses root span's metadata (no spanId)
- [ ] Test trace.addFeedback() uses root span's metadata (no spanId)
- [ ] Test mastra.getTrace() returns Trace with spans
- [ ] Test historical span has metadata from stored record
- [ ] Test historical span allows scores/feedback
- [ ] Test historical span throws on modification
- [ ] Test DefaultExporter writes scores
- [ ] Test DefaultExporter writes feedback
- [ ] Test auto-extracted metrics for scores (in PR 3.2)
- [ ] Test auto-extracted metrics for feedback (in PR 3.2)
