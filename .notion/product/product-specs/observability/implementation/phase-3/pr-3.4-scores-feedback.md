# PR 3.4: Scores & Feedback Implementation

**Package:** `observability/mastra`
**Scope:** Span/Trace score/feedback APIs, historical spans, exporter updates
**Prerequisites:** PR 3.3 (Auto-Extracted Metrics)

**Note:** The `ObservabilityBus` was created in Phase 1 and already handles ScoreEvent and FeedbackEvent types.

---

## 3.4.1 Update Span Implementation

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

## 3.4.2 Update NoOp Span

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

## 3.4.3 Implement Trace Class

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

## 3.4.4 Implement Mastra.getTrace()

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

## 3.4.5 Historical Span Implementation

**File:** `observability/mastra/src/spans/historical.ts` (new)

```typescript
import type { Span, ScoreInput, FeedbackInput, SpanRecord, ExportedScore, ExportedFeedback, ScoreEvent, FeedbackEvent } from '@mastra/core';
import { ObservabilityBus } from '../bus/observability';

/**
 * A span loaded from storage that can still receive scores/feedback
 * but cannot be modified (already ended).
 *
 * Use the `readonly` flag for type guards instead of throwing errors.
 */
export class HistoricalSpanImpl implements Span {
  /**
   * Indicates this span is historical and cannot be modified.
   * Use this flag for type guards instead of try/catch.
   *
   * @example
   * if (span.readonly) {
   *   // Historical span - can only add scores/feedback
   * } else {
   *   // Active span - can modify
   * }
   */
  readonly readonly = true;

  constructor(
    private record: SpanRecord,
    private bus: ObservabilityBus,
  ) {}

  get traceId(): string { return this.record.traceId; }
  get spanId(): string { return this.record.id; }
  get name(): string { return this.record.name; }
  get metadata(): Record<string, unknown> | undefined { return this.record.metadata; }
  get isRootSpan(): boolean { return !this.record.parentSpanId; }

  // Modification methods are no-ops for historical spans
  // Check `readonly` flag before calling if you need to know

  setStatus(): void {
    // No-op for historical spans
  }

  setAttribute(): void {
    // No-op for historical spans
  }

  addEvent(): void {
    // No-op for historical spans
  }

  end(): void {
    // No-op for historical spans (already ended)
  }

  update(): void {
    // No-op for historical spans
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

/**
 * Type guard to check if a span is historical (readonly).
 */
export function isHistoricalSpan(span: Span): span is HistoricalSpanImpl {
  return 'readonly' in span && span.readonly === true;
}
```

**Notes:**
- Uses `readonly` flag instead of throwing errors for better type guards
- Modification methods are no-ops instead of throwing
- `isHistoricalSpan()` type guard for runtime checks

**Tasks:**
- [ ] Implement HistoricalSpanImpl with `readonly` flag
- [ ] Make modification methods no-ops (not throwing)
- [ ] Add `isHistoricalSpan()` type guard
- [ ] Allow addScore/addFeedback
- [ ] Use record's existing metadata

---

## 3.4.6 Update DefaultExporter

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

## 3.4.7 Update JsonExporter

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

## 3.4.8 Update CloudExporter

**File:** `observability/cloud/src/exporter.ts` (if exists)

**Tasks:**
- [ ] Implement `onScoreEvent()` handler
- [ ] Implement `onFeedbackEvent()` handler
- [ ] Send to Mastra Cloud API

---

## PR 3.4 Testing

**Tasks:**
- [ ] Test span.addScore() includes span's metadata in event
- [ ] Test span.addFeedback() includes span's metadata in event
- [ ] Test trace.addScore() uses root span's metadata (no spanId)
- [ ] Test trace.addFeedback() uses root span's metadata (no spanId)
- [ ] Test mastra.getTrace() returns Trace with spans
- [ ] Test historical span has metadata from stored record
- [ ] Test historical span allows scores/feedback
- [ ] Test historical span has `readonly === true`
- [ ] Test historical span modification methods are no-ops
- [ ] Test `isHistoricalSpan()` type guard
- [ ] Test DefaultExporter writes scores
- [ ] Test DefaultExporter writes feedback

**Note:** Auto-extracted metrics for scores/feedback are in PR 3.5.
