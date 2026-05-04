---
'@mastra/core': minor
---

Aligned the scorer hook with the unified `ScoreEvent` pipeline. `MastraScorer.run()` is now the single producer of score events through `mastra.observability.addScore()`, so any exporter implementing `onScoreEvent` automatically receives scores. The previous per-exporter `addScoreToTrace` side-channel called from the scorer hook has been removed; `addScoreToTrace` itself is preserved as `@deprecated` on each exporter for backwards compatibility.

**Before**

```ts
// Exporters received scores through a one-off method that bypassed the
// observability event bus, so signals like sampling and redaction did not apply.
class MyExporter {
  async addScoreToTrace({ traceId, spanId, score, scorerName, reason, metadata }) {
    /* submit to your backend */
  }
}
```

**After**

```ts
import type { ScoreEvent } from '@mastra/core/observability';

// Exporters now implement onScoreEvent — the same shape as onTracingEvent / onLogEvent.
class MyExporter {
  async onScoreEvent(event: ScoreEvent) {
    const { traceId, spanId, scorerName, score, reason, metadata } = event.score;
    /* submit to your backend */
  }
}

// Producers can also emit scores directly:
await mastra.observability.addScore({
  traceId,
  spanId,
  score: { scorerId: 'accuracy', score: 0.92, reason: 'good' },
});
```
