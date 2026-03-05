## PR 2.4: ClickHouse Logs Support

**Package:** `stores/clickhouse`
**Scope:** Logs table and storage methods

### 2.4.1 Logs Table Schema

**File:** `stores/clickhouse/src/storage/domains/observability/index.ts` (modify)

```sql
CREATE TABLE IF NOT EXISTS mastra_ai_logs (
  Timestamp DateTime64(9) CODEC(Delta(8), ZSTD(1)),
  LogId String CODEC(ZSTD(1)),
  Level LowCardinality(String) CODEC(ZSTD(1)),
  Message String CODEC(ZSTD(1)),
  Data Map(LowCardinality(String), String) CODEC(ZSTD(1)),

  -- Correlation
  TraceId String CODEC(ZSTD(1)),
  SpanId String CODEC(ZSTD(1)),
  RunId String CODEC(ZSTD(1)),
  SessionId String CODEC(ZSTD(1)),
  ThreadId String CODEC(ZSTD(1)),
  RequestId String CODEC(ZSTD(1)),

  -- Entity context
  EntityType LowCardinality(String) CODEC(ZSTD(1)),
  EntityName LowCardinality(String) CODEC(ZSTD(1)),

  -- Multi-tenancy
  UserId String CODEC(ZSTD(1)),
  OrganizationId LowCardinality(String) CODEC(ZSTD(1)),
  ResourceId String CODEC(ZSTD(1)),

  -- Environment
  Environment LowCardinality(String) CODEC(ZSTD(1)),
  ServiceName LowCardinality(String) CODEC(ZSTD(1)),
  Source LowCardinality(String) CODEC(ZSTD(1)),

  -- Filtering
  Tags Array(String) CODEC(ZSTD(1)),

  -- Indexes for efficient queries
  INDEX idx_trace_id TraceId TYPE bloom_filter(0.001) GRANULARITY 1,
  INDEX idx_run_id RunId TYPE bloom_filter(0.01) GRANULARITY 1,
  INDEX idx_data_key mapKeys(Data) TYPE bloom_filter(0.01) GRANULARITY 1,
  INDEX idx_data_value mapValues(Data) TYPE bloom_filter(0.01) GRANULARITY 1,
  INDEX idx_message Message TYPE tokenbf_v1(10240, 3, 0) GRANULARITY 4
)
ENGINE = MergeTree
PARTITION BY toDate(Timestamp)
ORDER BY (ServiceName, Level, toUnixTimestamp(Timestamp))
TTL toDateTime(Timestamp) + INTERVAL 30 DAY
```

**Notes:**
- `Map(LowCardinality(String), String)` for `Data` allows searching/filtering on data keys/values
- `bloom_filter` indexes on `mapKeys(Data)` and `mapValues(Data)` enable filtering on specific data fields
- `tokenbf_v1` index on `Message` enables full-text search
- `LowCardinality` for known low-cardinality fields
- 30-day TTL default (configurable)

**Tasks:**
- [ ] Add logs table creation to `init()`
- [ ] Use ClickHouse-optimized types
- [ ] Add bloom filter indexes for efficient queries

### 2.4.2 Implement batchCreateLogs

**File:** `stores/clickhouse/src/storage/domains/observability/index.ts` (modify)

```typescript
async batchCreateLogs(args: BatchCreateLogsArgs): Promise<void> {
  const { logs } = args;
  if (logs.length === 0) return;

  const rows = logs.map(log => ({
    Timestamp: log.timestamp.toISOString(),
    LogId: log.id,
    Level: log.level,
    Message: log.message,
    Data: this.objectToMap(log.data ?? {}),
    TraceId: log.traceId ?? '',
    SpanId: log.spanId ?? '',
    RunId: log.runId ?? '',
    SessionId: log.sessionId ?? '',
    ThreadId: log.threadId ?? '',
    RequestId: log.requestId ?? '',
    EntityType: log.entityType ?? '',
    EntityName: log.entityName ?? '',
    UserId: log.userId ?? '',
    OrganizationId: log.organizationId ?? '',
    ResourceId: log.resourceId ?? '',
    Environment: log.environment ?? '',
    ServiceName: log.serviceName ?? '',
    Source: log.source ?? '',
    Tags: log.tags ?? [],
  }));

  await this.client.insert({
    table: 'mastra_ai_logs',
    values: rows,
    format: 'JSONEachRow',
  });
}

private objectToMap(obj: Record<string, unknown>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    map[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return map;
}
```

**Tasks:**
- [ ] Implement batch insert
- [ ] Convert data object to Map format
- [ ] Use JSONEachRow format

### 2.4.3 Implement listLogs

**File:** `stores/clickhouse/src/storage/domains/observability/index.ts` (modify)

```typescript
async listLogs(args: ListLogsArgs): Promise<PaginatedResult<LogRecord>> {
  const { filters, pagination, orderBy } = args;

  let query = 'SELECT * FROM mastra_ai_logs WHERE 1=1';
  const params: Record<string, unknown> = {};

  // Apply filters
  if (filters?.traceId) {
    query += ' AND TraceId = {traceId:String}';
    params.traceId = filters.traceId;
  }
  if (filters?.level) {
    const levels = Array.isArray(filters.level) ? filters.level : [filters.level];
    query += ` AND Level IN ({levels:Array(String)})`;
    params.levels = levels;
  }
  if (filters?.startTime) {
    query += ' AND Timestamp >= {startTime:DateTime64(9)}';
    params.startTime = filters.startTime.toISOString();
  }
  if (filters?.endTime) {
    query += ' AND Timestamp <= {endTime:DateTime64(9)}';
    params.endTime = filters.endTime.toISOString();
  }
  if (filters?.search) {
    query += ' AND hasToken(Message, {search:String})';
    params.search = filters.search;
  }
  if (filters?.dataKeys) {
    // Filter logs that have specific keys in Data map
    for (const key of filters.dataKeys) {
      query += ` AND mapContains(Data, {dataKey_${key}:String})`;
      params[`dataKey_${key}`] = key;
    }
  }

  // Order
  const order = orderBy?.direction ?? 'DESC';
  query += ` ORDER BY Timestamp ${order}`;

  // Pagination
  const limit = pagination?.limit ?? 100;
  const offset = pagination?.offset ?? 0;
  query += ` LIMIT {limit:UInt32} OFFSET {offset:UInt32}`;
  params.limit = limit;
  params.offset = offset;

  const result = await this.client.query({
    query,
    query_params: params,
    format: 'JSONEachRow',
  });

  const rows = await result.json<ClickHouseLogRow[]>();

  return {
    data: rows.map(this.rowToLogRecord.bind(this)),
    pagination: {
      total: await this.getLogCount(filters),
      limit,
      offset,
    },
  };
}

private rowToLogRecord(row: ClickHouseLogRow): LogRecord {
  return {
    id: row.LogId,
    timestamp: new Date(row.Timestamp),
    level: row.Level as LogLevel,
    message: row.Message,
    data: this.mapToObject(row.Data),
    traceId: row.TraceId || undefined,
    spanId: row.SpanId || undefined,
    // ... map all fields
  };
}

private mapToObject(map: Record<string, string>): Record<string, unknown> | undefined {
  if (!map || Object.keys(map).length === 0) return undefined;

  const obj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(map)) {
    try {
      obj[key] = JSON.parse(value);
    } catch {
      obj[key] = value;
    }
  }
  return obj;
}
```

**Tasks:**
- [ ] Implement listLogs with ClickHouse query syntax
- [ ] Support filtering on Data map keys
- [ ] Support full-text search on Message
- [ ] Map rows to LogRecord

### 2.4.4 Update Capabilities

```typescript
get capabilities(): StorageCapabilities {
  return {
    tracing: { preferred: 'insert-only', supported: ['insert-only'] },
    logs: { preferred: 'insert-only', supported: ['insert-only'] },
    metrics: { supported: false },
    scores: { supported: false },
    feedback: { supported: false },
  };
}
```

**Tasks:**
- [ ] Set logs capability to supported

### PR 2.4 Testing

**Tasks:**
- [ ] Test logs table creation
- [ ] Test batchCreateLogs inserts correctly
- [ ] Test listLogs with various filters
- [ ] Test Data map filtering
- [ ] Test full-text search
- [ ] Test pagination

