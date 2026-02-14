# PR 1.3: DuckDB Storage Adapter

**Package:** `stores/duckdb`
**Scope:** Add observability storage to existing DuckDB package

---

## 1.3.1 Package Structure

**Current structure:**
```
stores/duckdb/src/
├── index.ts
├── vector/
│   ├── index.ts
│   └── types.ts
```

**Add:**
```
stores/duckdb/src/
├── index.ts (modify - add exports)
├── storage/
│   ├── index.ts (DuckDBStore)
│   └── domains/
│       └── observability/
│           └── index.ts (ObservabilityDuckDB)
├── vector/
│   └── ...
```

---

## 1.3.2 Create DuckDBStore

**File:** `stores/duckdb/src/storage/index.ts` (new)

**Tasks:**
- [ ] Create DuckDBStore class extending MastraCompositeStore
- [ ] Initialize ObservabilityDuckDB domain
- [ ] Support `:memory:` and file-based persistence
- [ ] Follow PostgresStore/LibSQLStore patterns

---

## 1.3.3 Create ObservabilityDuckDB

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (new)

```typescript
import { ObservabilityStorage, TracingStorageStrategy } from '@mastra/core/storage';

export class ObservabilityDuckDB extends ObservabilityStorage {
  // Override to declare tracing support
  public override get tracingStrategy(): {
    preferred: TracingStorageStrategy;
    supported: TracingStorageStrategy[];
  } {
    return {
      preferred: 'batch-with-updates',  // Batch is more efficient
      supported: ['realtime', 'batch-with-updates'],
    };
  }

  // logsStrategy, metricsStrategy, etc. remain null (not supported in Phase 1)
  // Will be overridden in later phases when those features are added

  async init(): Promise<void> {
    // Create spans table...
  }

  // ... other method implementations
}
```

**Tasks:**
- [ ] Extend ObservabilityStorage base class
- [ ] Override `tracingStrategy` getter to declare support
- [ ] Implement `init()` - create spans table
- [ ] Implement `batchCreateSpans()`
- [ ] Implement `batchUpdateSpans()`
- [ ] Implement `getSpan()`
- [ ] Implement `getRootSpan()`
- [ ] Implement `getTrace()`
- [ ] Implement `listTraces()`
- [ ] Implement `batchDeleteTraces()`
- [ ] Implement `dangerouslyClearAll()`

---

## 1.3.4 Spans Table Schema

```sql
CREATE TABLE IF NOT EXISTS mastra_ai_spans (
  id VARCHAR PRIMARY KEY,
  trace_id VARCHAR NOT NULL,
  parent_span_id VARCHAR,
  name VARCHAR NOT NULL,
  type VARCHAR NOT NULL,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  status VARCHAR,
  input JSON,
  output JSON,
  metadata JSON,
  tags VARCHAR[],
  entity_type VARCHAR,
  entity_name VARCHAR,
  entity_id VARCHAR,
  user_id VARCHAR,
  organization_id VARCHAR,
  resource_id VARCHAR,
  run_id VARCHAR,
  session_id VARCHAR,
  thread_id VARCHAR,
  request_id VARCHAR,
  environment VARCHAR,
  service_name VARCHAR,
  source VARCHAR,
  error_info JSON,
  has_child_error BOOLEAN DEFAULT FALSE,
  scope JSON,
  attributes JSON
);

CREATE INDEX IF NOT EXISTS idx_spans_trace_id ON mastra_ai_spans(trace_id);
CREATE INDEX IF NOT EXISTS idx_spans_started_at ON mastra_ai_spans(started_at DESC);
```

**Tasks:**
- [ ] Create table in `init()`
- [ ] Create indexes

---

## 1.3.5 Export Updates

**File:** `stores/duckdb/src/index.ts` (modify)

**Tasks:**
- [ ] Export DuckDBStore
- [ ] Export types

---

## PR 1.3 Testing

**Tasks:**
- [ ] Test spans CRUD operations
- [ ] Test listTraces with filters
- [ ] Test in-memory mode
- [ ] Test file persistence mode
