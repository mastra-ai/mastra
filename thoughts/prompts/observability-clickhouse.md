# LANE 3c - ClickHouse + Ingestion Worker (after LANE 3a and 3b)

Create implementation plan for LANE 3c: @mastra/observability-clickhouse.

Reference the master plan at thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md for context.

**Dependencies**:
- LANE 3a (Observability Writer) must be complete
- LANE 3b (Local File Storage) must be complete

This includes:
- observability/clickhouse/ package setup
- ClickHouse schema and table creation:
  - traces, spans, logs, metrics, scores tables
  - Proper column types for time-series data
  - Materialized views for aggregations
- ClickHouseQueryProvider implementing ObservabilityQueryProvider:
  - Query traces, spans, logs, metrics by project/deployment
  - Time-range filtering
  - Aggregation queries
- Ingestion Worker that:
  - Watches file storage for new JSONL files
  - Reads and parses files in batches
  - Bulk inserts into ClickHouse
  - Moves processed files to processed/ directory (or deletes)
  - Handles failures with retry logic
  - Can run as standalone process or embedded
- CLI for running worker standalone:
  ```bash
  npx @mastra/observability-clickhouse ingest \
    --file-storage-type local \
    --file-storage-path /var/mastra/observability \
    --clickhouse-url http://localhost:8123 \
    --poll-interval 10000
  ```

Key interfaces:
```typescript
export class IngestionWorker {
  constructor(config: IngestionWorkerConfig);
  start(): Promise<void>;
  stop(): Promise<void>;
  processOnce(): Promise<ProcessingResult>;
  getStatus(): WorkerStatus;
}
```

Save plan to: thoughts/shared/plans/2025-01-23-observability-clickhouse.md
