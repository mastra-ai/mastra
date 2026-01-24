# LANE 3a - Observability Writer (parallel with other Phase 2 lanes)

Create implementation plan for LANE 3a: @mastra/observability-writer core writer.

Reference the master plan at thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md for context.

**Dependencies**: LANE 1 (Core Package) must be complete first (for interfaces).

This includes:
- observability/writer/ package setup
- ObservabilityWriter class that:
  - Accepts traces, spans, logs, metrics, scores
  - Batches events in memory (configurable batch size/flush interval)
  - Writes batches to FileStorageProvider as JSONL files
  - Handles file rotation (time-based or size-based)
  - Thread-safe event buffering
- Event batching logic (batcher.ts)
- File naming convention: {type}/{project_id}/{timestamp}_{uuid}.jsonl
- JSONL serialization (serializer.ts)
- Graceful shutdown (flush pending events)

Key interface:
```typescript
export class ObservabilityWriter {
  constructor(config: ObservabilityWriterConfig);
  recordTrace(trace: Trace): void;
  recordSpan(span: Span): void;
  recordLog(log: Log): void;
  recordMetric(metric: Metric): void;
  recordScore(score: Score): void;
  recordEvents(events: ObservabilityEvent[]): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}
```

Save plan to: thoughts/shared/plans/2025-01-23-observability-writer.md
