# PR 3.4: Scores & Feedback Implementation

**Package:** `observability/mastra`
**Scope:** Span/Trace score/feedback APIs, recorded spans, exporter updates
**Prerequisites:** PR 3.3 (Auto-Extracted Metrics)

**Note:** The `ObservabilityBus` was created in Phase 1 and already handles ScoreEvent and FeedbackEvent types.

**Type Architecture Note:** This PR implements the `RecordedSpan` and `RecordedTrace` interfaces defined in `@mastra/core`. These types extend `SpanData` (not `ExportedSpan`) to keep the "exported" (outbound) and "recorded" (inbound) concerns separate while sharing the same data shape.

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

## 3.4.3 Implement RecordedTrace Class

**File:** `observability/mastra/src/traces/recorded-trace.ts` (new)

```typescript
import type { RecordedTrace, AnyRecordedSpan, ScoreInput, FeedbackInput, ExportedScore, ExportedFeedback, ScoreEvent, FeedbackEvent } from '@mastra/core';
import { ObservabilityBus } from '../bus/observability';

export class RecordedTraceImpl implements RecordedTrace {
  constructor(
    public readonly traceId: string,
    public readonly rootSpan: AnyRecordedSpan,
    public readonly spans: ReadonlyArray<AnyRecordedSpan>,
    private spanMap: Map<string, AnyRecordedSpan>,
    private bus: ObservabilityBus,
  ) {}

  getSpan(spanId: string): AnyRecordedSpan | null {
    return this.spanMap.get(spanId) ?? null;
  }

  addScore(score: ScoreInput): void {
    const exportedScore: ExportedScore = {
      timestamp: new Date(),
      traceId: this.traceId,
      spanId: undefined,
      scorerName: score.scorerName,
      score: score.score,
      reason: score.reason,
      experimentId: score.experimentId,
      metadata: {
        ...this.rootSpan.metadata,
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
      experimentId: feedback.experimentId,
      metadata: {
        ...this.rootSpan.metadata,
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
- Tree access via `rootSpan`, flat access via `spans` (same objects, no duplication)
- `spanMap` provides O(1) lookup for `getSpan()`

**Tasks:**
- [ ] Implement RecordedTraceImpl class
- [ ] Support tree access (rootSpan with children)
- [ ] Support flat access (spans array)
- [ ] Support trace-level scores (no spanId)
- [ ] Support trace-level feedback (no spanId)
- [ ] Use root span's metadata for context
- [ ] Implement getSpan() with Map lookup

---

## 3.4.4 Implement Mastra.getTrace()

**File:** `observability/mastra/src/instances/base.ts` (modify)

```typescript
async getTrace(traceId: string): Promise<RecordedTrace | null> {
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

  // Build RecordedSpan objects with tree structure
  return buildRecordedTrace(traceId, result.data, this.observabilityBus);
}
```

**Helper:** `buildRecordedTrace()` (see 3.4.5)

```typescript
function buildRecordedTrace(
  traceId: string,
  spanRecords: SpanRecord[],
  bus: ObservabilityBus,
): RecordedTrace {
  // 1. Create RecordedSpan objects (without parent/children wired up)
  const spanMap = new Map<string, RecordedSpanImpl>();
  for (const record of spanRecords) {
    spanMap.set(record.id, new RecordedSpanImpl(record, bus));
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
    throw new Error(`No root span found for trace ${traceId}`);
  }

  // 4. Build flat array (same objects as tree)
  const spans = [...spanMap.values()];

  return new RecordedTraceImpl(traceId, rootSpan, spans, spanMap, bus);
}
```

**Tasks:**
- [ ] Implement getTrace() on BaseObservabilityInstance
- [ ] Fetch spans from storage
- [ ] Build tree structure (parent/children references)
- [ ] Return RecordedTraceImpl with both tree and flat access

---

## 3.4.5 RecordedSpan Implementation

**File:** `observability/mastra/src/spans/recorded-span.ts` (new)

```typescript
import type { RecordedSpan, AnyRecordedSpan, ScoreInput, FeedbackInput, SpanRecord, SpanType, ExportedScore, ExportedFeedback, ScoreEvent, FeedbackEvent } from '@mastra/core';
import { ObservabilityBus } from '../bus/observability';

/**
 * A span loaded from storage that can have scores/feedback attached.
 * Implements tree structure via parent/children references.
 *
 * The core span data is immutable (from storage), but annotation
 * methods (addScore, addFeedback) emit events for persistence.
 */
export class RecordedSpanImpl<TType extends SpanType = SpanType> implements RecordedSpan<TType> {
  // Tree structure - wired up after construction
  private _parent?: AnyRecordedSpan;
  private _children: AnyRecordedSpan[] = [];

  constructor(
    private record: SpanRecord,
    private bus: ObservabilityBus,
  ) {}

  // SpanData properties (from record)
  get id(): string { return this.record.id; }
  get traceId(): string { return this.record.traceId; }
  get name(): string { return this.record.name; }
  get type(): TType { return this.record.type as TType; }
  get startTime(): Date { return this.record.startTime; }
  get endTime(): Date | undefined { return this.record.endTime; }
  get parentSpanId(): string | undefined { return this.record.parentSpanId; }
  get isRootSpan(): boolean { return !this.record.parentSpanId; }
  get metadata(): Record<string, unknown> | undefined { return this.record.metadata; }
  get attributes(): any { return this.record.attributes; }
  get input(): any { return this.record.input; }
  get output(): any { return this.record.output; }
  get errorInfo(): any { return this.record.errorInfo; }
  get tags(): string[] | undefined { return this.record.tags; }
  get isEvent(): boolean { return this.record.isEvent; }
  get entityType(): any { return this.record.entityType; }
  get entityId(): string | undefined { return this.record.entityId; }
  get entityName(): string | undefined { return this.record.entityName; }

  // Tree structure
  get parent(): AnyRecordedSpan | undefined { return this._parent; }
  get children(): ReadonlyArray<AnyRecordedSpan> { return this._children; }

  // Internal methods for wiring up tree (called by buildRecordedTrace)
  _setParent(parent: AnyRecordedSpan): void { this._parent = parent; }
  _addChild(child: AnyRecordedSpan): void { this._children.push(child); }

  addScore(score: ScoreInput): void {
    const exportedScore: ExportedScore = {
      timestamp: new Date(),
      traceId: this.traceId,
      spanId: this.id,
      scorerName: score.scorerName,
      score: score.score,
      reason: score.reason,
      experimentId: score.experimentId,
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
      spanId: this.id,
      source: feedback.source,
      feedbackType: feedback.feedbackType,
      value: feedback.value,
      comment: feedback.comment,
      experimentId: feedback.experimentId,
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

**Notes:**
- Implements `RecordedSpan` interface (extends `SpanData`)
- Tree structure wired up via `_setParent()` / `_addChild()` after construction
- All SpanData properties delegated to underlying record
- `addScore` / `addFeedback` emit events for persistence

**Tasks:**
- [ ] Implement RecordedSpanImpl class
- [ ] Implement all SpanData property getters
- [ ] Implement parent/children tree structure
- [ ] Implement addScore() - emit ScoreEvent
- [ ] Implement addFeedback() - emit FeedbackEvent
- [ ] Use record's existing metadata for context

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
- [ ] Test mastra.getTrace() returns RecordedTrace with spans
- [ ] Test RecordedTrace has rootSpan (tree access)
- [ ] Test RecordedTrace has spans array (flat access)
- [ ] Test tree and flat access reference same span objects
- [ ] Test RecordedSpan has parent/children tree structure
- [ ] Test RecordedSpan has metadata from stored record
- [ ] Test RecordedSpan.addScore() emits ScoreEvent
- [ ] Test RecordedSpan.addFeedback() emits FeedbackEvent
- [ ] Test DefaultExporter writes scores
- [ ] Test DefaultExporter writes feedback

**Note:** Auto-extracted metrics for scores/feedback are in PR 3.5.
