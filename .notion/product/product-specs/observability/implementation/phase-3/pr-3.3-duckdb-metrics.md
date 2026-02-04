## PR 3.3: DuckDB Metrics Support

**Package:** `stores/duckdb`
**Scope:** Metrics table and storage methods

### 3.3.1 Metrics Table Schema

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (modify)

```sql
CREATE TABLE IF NOT EXISTS mastra_ai_metrics (
  id VARCHAR PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  name VARCHAR NOT NULL,
  type VARCHAR NOT NULL,
  value DOUBLE NOT NULL,

  -- Labels stored as JSON (for flexibility)
  labels JSON,

  -- Environment
  organization_id VARCHAR,
  environment VARCHAR,
  service_name VARCHAR,

  -- Histogram support
  bucket_boundaries DOUBLE[],
  bucket_counts BIGINT[]
);

CREATE INDEX IF NOT EXISTS idx_metrics_name ON mastra_ai_metrics(name);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON mastra_ai_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_name_timestamp ON mastra_ai_metrics(name, timestamp DESC);
```

**Tasks:**
- [ ] Add metrics table creation to `init()`
- [ ] Create indexes for time-series queries

### 3.3.2 Implement batchRecordMetrics

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (modify)

```typescript
async batchRecordMetrics(args: BatchRecordMetricsArgs): Promise<void> {
  const { metrics } = args;
  if (metrics.length === 0) return;

  const stmt = this.db.prepare(`
    INSERT INTO mastra_ai_metrics (
      id, timestamp, name, type, value, labels,
      organization_id, environment, service_name,
      bucket_boundaries, bucket_counts
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const metric of metrics) {
    stmt.run(
      metric.id,
      metric.timestamp.toISOString(),
      metric.name,
      metric.type,
      metric.value,
      JSON.stringify(metric.labels),
      metric.organizationId ?? null,
      metric.environment ?? null,
      metric.serviceName ?? null,
      metric.bucketBoundaries ? JSON.stringify(metric.bucketBoundaries) : null,
      metric.bucketCounts ? JSON.stringify(metric.bucketCounts) : null,
    );
  }
}
```

**Tasks:**
- [ ] Implement batch insert
- [ ] Handle labels JSON serialization

### 3.3.3 Implement listMetrics

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (modify)

```typescript
async listMetrics(args: ListMetricsArgs): Promise<PaginatedResult<MetricRecord>> {
  const { filters, pagination, orderBy, aggregation } = args;

  // Build query based on whether aggregation is requested
  if (aggregation) {
    return this.listMetricsAggregated(args);
  }

  let query = 'SELECT * FROM mastra_ai_metrics WHERE 1=1';
  const params: unknown[] = [];

  // Apply filters
  if (filters?.name) {
    const names = Array.isArray(filters.name) ? filters.name : [filters.name];
    query += ` AND name IN (${names.map(() => '?').join(', ')})`;
    params.push(...names);
  }
  if (filters?.startTime) {
    query += ' AND timestamp >= ?';
    params.push(filters.startTime.toISOString());
  }
  if (filters?.endTime) {
    query += ' AND timestamp <= ?';
    params.push(filters.endTime.toISOString());
  }
  if (filters?.labels) {
    // DuckDB JSON filtering
    for (const [key, value] of Object.entries(filters.labels)) {
      query += ` AND json_extract_string(labels, '$.${key}') = ?`;
      params.push(value);
    }
  }

  // Order and pagination
  const order = orderBy?.direction ?? 'desc';
  query += ` ORDER BY ${orderBy?.field ?? 'timestamp'} ${order}`;
  const limit = pagination?.limit ?? 100;
  const offset = pagination?.offset ?? 0;
  query += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = this.db.prepare(query).all(...params);

  return {
    data: rows.map(this.rowToMetricRecord),
    pagination: { total: this.getMetricCount(filters), limit, offset },
  };
}

private listMetricsAggregated(args: ListMetricsArgs): Promise<PaginatedResult<MetricRecord>> {
  const { filters, aggregation } = args;

  // Build aggregation query
  let selectCols = [`${aggregation!.type}(value) as value`];
  let groupBy: string[] = ['name'];

  if (aggregation!.interval) {
    selectCols.push(`time_bucket(INTERVAL '${aggregation!.interval}', timestamp) as timestamp`);
    groupBy.push('timestamp');
  }

  if (aggregation!.groupBy) {
    for (const label of aggregation!.groupBy) {
      selectCols.push(`json_extract_string(labels, '$.${label}') as label_${label}`);
      groupBy.push(`label_${label}`);
    }
  }

  let query = `SELECT name, ${selectCols.join(', ')} FROM mastra_ai_metrics WHERE 1=1`;
  // ... add filters ...
  query += ` GROUP BY ${groupBy.join(', ')}`;

  // Execute and return
  // ...
}
```

**Tasks:**
- [ ] Implement listMetrics with filters
- [ ] Support label filtering via JSON extraction
- [ ] Implement aggregation queries
- [ ] Use DuckDB time_bucket for time-series grouping

### 3.3.4 Update Capabilities

```typescript
// Add metrics strategy getter
get metricsStrategy(): { preferred: MetricsStorageStrategy; supported: MetricsStorageStrategy[] } {
  return { preferred: 'batch', supported: ['realtime', 'batch'] };
}
```

**Tasks:**
- [ ] Add `metricsStrategy` getter to declare metrics support

### PR 3.3 Testing

**Tasks:**
- [ ] Test metrics table creation
- [ ] Test batchRecordMetrics inserts correctly
- [ ] Test listMetrics with various filters
- [ ] Test label filtering
- [ ] Test aggregation queries
- [ ] Test time-series grouping

