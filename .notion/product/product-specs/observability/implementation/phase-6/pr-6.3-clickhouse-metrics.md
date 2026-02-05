## PR 3.4: ClickHouse Metrics Support

**Package:** `stores/clickhouse`
**Scope:** Metrics table and storage methods

### 3.4.1 Metrics Table Schema

**File:** `stores/clickhouse/src/storage/domains/observability/index.ts` (modify)

```sql
CREATE TABLE IF NOT EXISTS mastra_ai_metrics (
  Timestamp DateTime64(9) CODEC(Delta(8), ZSTD(1)),
  MetricId String CODEC(ZSTD(1)),
  Name LowCardinality(String) CODEC(ZSTD(1)),
  Type LowCardinality(String) CODEC(ZSTD(1)),
  Value Float64 CODEC(ZSTD(1)),

  -- Labels as Map for efficient storage and querying
  Labels Map(LowCardinality(String), String) CODEC(ZSTD(1)),

  -- Environment
  OrganizationId LowCardinality(String) CODEC(ZSTD(1)),
  Environment LowCardinality(String) CODEC(ZSTD(1)),
  ServiceName LowCardinality(String) CODEC(ZSTD(1)),

  -- Indexes
  INDEX idx_labels_key mapKeys(Labels) TYPE bloom_filter(0.01) GRANULARITY 1,
  INDEX idx_labels_value mapValues(Labels) TYPE bloom_filter(0.01) GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toDate(Timestamp)
ORDER BY (Name, toUnixTimestamp(Timestamp))
TTL toDateTime(Timestamp) + INTERVAL 90 DAY
```

**Notes:**
- `Map(LowCardinality(String), String)` for Labels enables efficient label filtering
- `bloom_filter` indexes on mapKeys/mapValues enable filtering on specific labels
- 90-day TTL default (metrics typically need longer retention than logs)

**Tasks:**
- [ ] Add metrics table creation to `init()`
- [ ] Use ClickHouse-optimized types
- [ ] Add bloom filter indexes for label queries

### 3.4.2 Implement batchRecordMetrics

**File:** `stores/clickhouse/src/storage/domains/observability/index.ts` (modify)

```typescript
async batchRecordMetrics(args: BatchRecordMetricsArgs): Promise<void> {
  const { metrics } = args;
  if (metrics.length === 0) return;

  const rows = metrics.map(metric => ({
    Timestamp: metric.timestamp.toISOString(),
    MetricId: metric.id,
    Name: metric.name,
    Type: metric.type,
    Value: metric.value,
    Labels: metric.labels,
    OrganizationId: metric.organizationId ?? '',
    Environment: metric.environment ?? '',
    ServiceName: metric.serviceName ?? '',
  }));

  await this.client.insert({
    table: 'mastra_ai_metrics',
    values: rows,
    format: 'JSONEachRow',
  });
}
```

**Tasks:**
- [ ] Implement batch insert
- [ ] Use Map type for labels

### 3.4.3 Implement listMetrics

**File:** `stores/clickhouse/src/storage/domains/observability/index.ts` (modify)

```typescript
async listMetrics(args: ListMetricsArgs): Promise<PaginatedResult<MetricRecord>> {
  const { filters, pagination, orderBy, aggregation } = args;

  if (aggregation) {
    return this.listMetricsAggregated(args);
  }

  let query = 'SELECT * FROM mastra_ai_metrics WHERE 1=1';
  const params: Record<string, unknown> = {};

  if (filters?.name) {
    const names = Array.isArray(filters.name) ? filters.name : [filters.name];
    query += ' AND Name IN ({names:Array(String)})';
    params.names = names;
  }
  if (filters?.startTime) {
    query += ' AND Timestamp >= {startTime:DateTime64(9)}';
    params.startTime = filters.startTime.toISOString();
  }
  if (filters?.labels) {
    // ClickHouse Map filtering
    for (const [key, value] of Object.entries(filters.labels)) {
      query += ` AND Labels[{labelKey_${key}:String}] = {labelValue_${key}:String}`;
      params[`labelKey_${key}`] = key;
      params[`labelValue_${key}`] = value;
    }
  }

  // Order and pagination
  query += ` ORDER BY Timestamp ${orderBy?.direction ?? 'DESC'}`;
  query += ` LIMIT {limit:UInt32} OFFSET {offset:UInt32}`;
  params.limit = pagination?.limit ?? 100;
  params.offset = pagination?.offset ?? 0;

  const result = await this.client.query({
    query,
    query_params: params,
    format: 'JSONEachRow',
  });

  const rows = await result.json<ClickHouseMetricRow[]>();

  return {
    data: rows.map(this.rowToMetricRecord.bind(this)),
    pagination: { total: await this.getMetricCount(filters), limit: params.limit, offset: params.offset },
  };
}

private async listMetricsAggregated(args: ListMetricsArgs): Promise<PaginatedResult<MetricRecord>> {
  const { filters, aggregation } = args;

  // ClickHouse aggregation with time bucketing
  let selectCols = [`${aggregation!.type}(Value) as Value`];
  let groupBy = ['Name'];

  if (aggregation!.interval) {
    const intervalSeconds = this.intervalToSeconds(aggregation!.interval);
    selectCols.push(`toStartOfInterval(Timestamp, INTERVAL ${intervalSeconds} second) as Timestamp`);
    groupBy.push('Timestamp');
  }

  if (aggregation!.groupBy) {
    for (const label of aggregation!.groupBy) {
      selectCols.push(`Labels[{groupLabel_${label}:String}] as label_${label}`);
      groupBy.push(`label_${label}`);
    }
  }

  let query = `SELECT Name, ${selectCols.join(', ')} FROM mastra_ai_metrics WHERE 1=1`;
  // ... add filters ...
  query += ` GROUP BY ${groupBy.join(', ')}`;
  query += ` ORDER BY Timestamp`;

  // Execute and return
}

private intervalToSeconds(interval: string): number {
  const map: Record<string, number> = {
    '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '1d': 86400,
  };
  return map[interval] ?? 60;
}
```

**Tasks:**
- [ ] Implement listMetrics with ClickHouse syntax
- [ ] Support Map-based label filtering
- [ ] Implement aggregation with toStartOfInterval
- [ ] Support groupBy labels

### 3.4.4 Update Capabilities

```typescript
get capabilities(): StorageCapabilities {
  return {
    tracing: { /* existing */ },
    logs: { /* existing */ },
    metrics: {
      preferred: 'insert-only',
      supported: ['insert-only'],
      supportsAggregation: true,
    },
    scores: { supported: false },
    feedback: { supported: false },
  };
}
```

**Tasks:**
- [ ] Set metrics capability
- [ ] Enable aggregation support

### PR 3.4 Testing

**Tasks:**
- [ ] Test metrics table creation
- [ ] Test batchRecordMetrics inserts correctly
- [ ] Test listMetrics with various filters
- [ ] Test Map-based label filtering
- [ ] Test aggregation queries
- [ ] Test time-series grouping

