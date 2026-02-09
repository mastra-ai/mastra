# PR 3.5: Score/Feedback Metrics Auto-Extraction

**Package:** `observability/mastra`
**Scope:** Auto-extract metrics from ScoreEvent and FeedbackEvent
**Prerequisites:** PR 3.3 (Auto-Extracted Metrics), PR 3.4 (Scores/Feedback)

---

## 3.5.1 Add Score/Feedback Processing to AutoExtractedMetrics

**File:** `observability/mastra/src/metrics/auto-extract.ts` (modify)

```typescript
import type { ScoreEvent, FeedbackEvent } from '@mastra/core';

export class AutoExtractedMetrics {
  // ... existing methods from PR 3.2

  processScoreEvent(event: ScoreEvent): void {
    const labels: Record<string, string> = {
      scorer: event.score.scorerName,
    };
    if (event.score.metadata?.entityType) {
      labels.entity_type = String(event.score.metadata.entityType);
    }
    if (event.score.experiment) {
      labels.experiment = event.score.experiment;
    }
    this.emit('mastra_scores_total', 'counter', 1, labels);
  }

  processFeedbackEvent(event: FeedbackEvent): void {
    const labels: Record<string, string> = {
      feedback_type: event.feedback.feedbackType,
      source: event.feedback.source,
    };
    if (event.feedback.metadata?.entityType) {
      labels.entity_type = String(event.feedback.metadata.entityType);
    }
    if (event.feedback.experiment) {
      labels.experiment = event.feedback.experiment;
    }
    this.emit('mastra_feedback_total', 'counter', 1, labels);
  }
}
```

**Tasks:**
- [ ] Add `processScoreEvent()` method
- [ ] Add `processFeedbackEvent()` method
- [ ] Import ScoreEvent and FeedbackEvent types

---

## 3.5.2 Update ObservabilityBus for Score/Feedback Cross-Emission

**File:** `observability/mastra/src/bus/observability.ts` (modify)

```typescript
emit(event: ObservabilityEvent): void {
  for (const exporter of this.exporters) {
    this.routeToHandler(exporter, event);
  }

  if (this.autoExtractor && isTracingEvent(event)) {
    this.autoExtractor.processTracingEvent(event);
  }

  // NEW: Score/feedback → metric cross-emission
  if (this.autoExtractor && event.type === 'score') {
    this.autoExtractor.processScoreEvent(event);
  }

  if (this.autoExtractor && event.type === 'feedback') {
    this.autoExtractor.processFeedbackEvent(event);
  }
}
```

**Tasks:**
- [ ] Add ScoreEvent → MetricEvent cross-emission
- [ ] Add FeedbackEvent → MetricEvent cross-emission

---

## PR 3.5 Testing

**Tasks:**
- [ ] Test score event emits `mastra_scores_total` metric
- [ ] Test feedback event emits `mastra_feedback_total` metric
- [ ] Test experiment label is included when present
- [ ] Test metrics appear in JsonExporter output
- [ ] Integration test: add score → verify metric emitted
- [ ] Integration test: add feedback → verify metric emitted
