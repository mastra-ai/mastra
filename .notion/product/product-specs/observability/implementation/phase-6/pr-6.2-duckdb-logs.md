## PR 2.3: DuckDB Logs Support

**Package:** `stores/duckdb`
**Scope:** Logs table and storage methods

### 2.3.1 Logs Table Schema

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (modify)

```sql
CREATE TABLE IF NOT EXISTS mastra_ai_logs (
  id VARCHAR PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  level VARCHAR NOT NULL,
  message TEXT NOT NULL,
  data JSON,

  -- Correlation
  trace_id VARCHAR,
  span_id VARCHAR,
  run_id VARCHAR,
  session_id VARCHAR,
  thread_id VARCHAR,
  request_id VARCHAR,

  -- Entity context
  entity_type VARCHAR,
  entity_name VARCHAR,

  -- Multi-tenancy
  user_id VARCHAR,
  organization_id VARCHAR,
  resource_id VARCHAR,

  -- Environment
  environment VARCHAR,
  service_name VARCHAR,
  source VARCHAR,

  -- Filtering
  tags VARCHAR[]
);

CREATE INDEX IF NOT EXISTS idx_logs_trace_id ON mastra_ai_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON mastra_ai_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON mastra_ai_logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_entity ON mastra_ai_logs(entity_type, entity_name);
```

**Tasks:**
- [ ] Add logs table creation to `init()`
- [ ] Create indexes for common queries

### 2.3.2 Implement batchCreateLogs

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (modify)

```typescript
async batchCreateLogs(args: BatchCreateLogsArgs): Promise<void> {
  const { logs } = args;
  if (logs.length === 0) return;

  const stmt = this.db.prepare(`
    INSERT INTO mastra_ai_logs (
      id, timestamp, level, message, data,
      trace_id, span_id, run_id, session_id, thread_id, request_id,
      entity_type, entity_name,
      user_id, organization_id, resource_id,
      environment, service_name, source,
      tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const log of logs) {
    stmt.run(
      log.id,
      log.timestamp.toISOString(),
      log.level,
      log.message,
      log.data ? JSON.stringify(log.data) : null,
      log.traceId ?? null,
      log.spanId ?? null,
      log.runId ?? null,
      log.sessionId ?? null,
      log.threadId ?? null,
      log.requestId ?? null,
      log.entityType ?? null,
      log.entityName ?? null,
      log.userId ?? null,
      log.organizationId ?? null,
      log.resourceId ?? null,
      log.environment ?? null,
      log.serviceName ?? null,
      log.source ?? null,
      log.tags ? JSON.stringify(log.tags) : null,
    );
  }
}
```

**Tasks:**
- [ ] Implement batch insert
- [ ] Handle JSON serialization for data and tags
- [ ] Consider transaction for batch

### 2.3.3 Implement listLogs

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (modify)

```typescript
async listLogs(args: ListLogsArgs): Promise<PaginatedResult<LogRecord>> {
  const { filters, pagination, orderBy } = args;

  let query = 'SELECT * FROM mastra_ai_logs WHERE 1=1';
  const params: unknown[] = [];

  // Apply filters
  if (filters?.traceId) {
    query += ' AND trace_id = ?';
    params.push(filters.traceId);
  }
  if (filters?.spanId) {
    query += ' AND span_id = ?';
    params.push(filters.spanId);
  }
  if (filters?.level) {
    const levels = Array.isArray(filters.level) ? filters.level : [filters.level];
    query += ` AND level IN (${levels.map(() => '?').join(', ')})`;
    params.push(...levels);
  }
  if (filters?.entityType) {
    query += ' AND entity_type = ?';
    params.push(filters.entityType);
  }
  if (filters?.entityName) {
    query += ' AND entity_name = ?';
    params.push(filters.entityName);
  }
  if (filters?.startTime) {
    query += ' AND timestamp >= ?';
    params.push(filters.startTime.toISOString());
  }
  if (filters?.endTime) {
    query += ' AND timestamp <= ?';
    params.push(filters.endTime.toISOString());
  }
  if (filters?.search) {
    query += ' AND message LIKE ?';
    params.push(`%${filters.search}%`);
  }
  // ... more filters

  // Order
  const order = orderBy?.direction ?? 'desc';
  query += ` ORDER BY timestamp ${order}`;

  // Pagination
  const limit = pagination?.limit ?? 100;
  const offset = pagination?.offset ?? 0;
  query += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = this.db.prepare(query).all(...params);

  return {
    data: rows.map(this.rowToLogRecord),
    pagination: {
      total: this.getLogCount(filters),
      limit,
      offset,
    },
  };
}

private rowToLogRecord(row: any): LogRecord {
  return {
    id: row.id,
    timestamp: new Date(row.timestamp),
    level: row.level,
    message: row.message,
    data: row.data ? JSON.parse(row.data) : undefined,
    traceId: row.trace_id ?? undefined,
    spanId: row.span_id ?? undefined,
    // ... map all fields
  };
}
```

**Tasks:**
- [ ] Implement listLogs with all filter support
- [ ] Add pagination
- [ ] Add ordering
- [ ] Map rows to LogRecord

### 2.3.4 Update Capabilities

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (modify)

```typescript
// Add logs strategy getter
get logsStrategy(): { preferred: LogsStorageStrategy; supported: LogsStorageStrategy[] } {
  return { preferred: 'batch', supported: ['realtime', 'batch'] };
}
```

**Tasks:**
- [ ] Add `logsStrategy` getter to declare logs support

### PR 2.3 Testing

**Tasks:**
- [ ] Test logs table creation
- [ ] Test batchCreateLogs inserts correctly
- [ ] Test listLogs with various filters
- [ ] Test pagination
- [ ] Test data JSON round-trip

