## PR 4.4: ClickHouse Scores/Feedback Support

**Package:** `stores/clickhouse`
**Scope:** Scores and Feedback tables and methods

### 4.4.1 Scores Table Schema

**File:** `stores/clickhouse/src/storage/domains/observability/index.ts` (modify)

```sql
CREATE TABLE IF NOT EXISTS mastra_ai_scores (
  Timestamp DateTime64(9) CODEC(Delta(8), ZSTD(1)),
  ScoreId String CODEC(ZSTD(1)),

  -- Target
  TraceId String CODEC(ZSTD(1)),
  SpanId String CODEC(ZSTD(1)),

  -- Score data
  ScorerName LowCardinality(String) CODEC(ZSTD(1)),
  Score Float64 CODEC(ZSTD(1)),
  Reason String CODEC(ZSTD(1)),
  Metadata String CODEC(ZSTD(1)),  -- JSON string
  Experiment LowCardinality(String) CODEC(ZSTD(1)),

  -- Multi-tenancy
  OrganizationId LowCardinality(String) CODEC(ZSTD(1)),
  UserId String CODEC(ZSTD(1)),

  -- Environment
  Environment LowCardinality(String) CODEC(ZSTD(1)),
  ServiceName LowCardinality(String) CODEC(ZSTD(1)),

  -- Indexes
  INDEX idx_trace_id TraceId TYPE bloom_filter(0.001) GRANULARITY 1,
  INDEX idx_span_id SpanId TYPE bloom_filter(0.01) GRANULARITY 1,
  INDEX idx_experiment Experiment TYPE bloom_filter(0.01) GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toDate(Timestamp)
ORDER BY (ScorerName, toUnixTimestamp(Timestamp))
TTL toDateTime(Timestamp) + INTERVAL 365 DAY
```

**Notes:**
- 365-day TTL for scores (longer retention for analysis)
- `LowCardinality` for scorer names and experiments

**Tasks:**
- [ ] Add scores table creation to `init()`

### 4.4.2 Feedback Table Schema

```sql
CREATE TABLE IF NOT EXISTS mastra_ai_feedback (
  Timestamp DateTime64(9) CODEC(Delta(8), ZSTD(1)),
  FeedbackId String CODEC(ZSTD(1)),

  -- Target
  TraceId String CODEC(ZSTD(1)),
  SpanId String CODEC(ZSTD(1)),

  -- Feedback data
  Source LowCardinality(String) CODEC(ZSTD(1)),
  FeedbackType LowCardinality(String) CODEC(ZSTD(1)),
  Value String CODEC(ZSTD(1)),  -- Store as string
  Comment String CODEC(ZSTD(1)),
  Experiment LowCardinality(String) CODEC(ZSTD(1)),

  -- Attribution
  UserId String CODEC(ZSTD(1)),

  -- Multi-tenancy
  OrganizationId LowCardinality(String) CODEC(ZSTD(1)),

  -- Environment
  Environment LowCardinality(String) CODEC(ZSTD(1)),
  ServiceName LowCardinality(String) CODEC(ZSTD(1)),

  -- Extra
  Metadata String CODEC(ZSTD(1)),

  -- Indexes
  INDEX idx_trace_id TraceId TYPE bloom_filter(0.001) GRANULARITY 1,
  INDEX idx_span_id SpanId TYPE bloom_filter(0.01) GRANULARITY 1,
  INDEX idx_experiment Experiment TYPE bloom_filter(0.01) GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toDate(Timestamp)
ORDER BY (FeedbackType, toUnixTimestamp(Timestamp))
TTL toDateTime(Timestamp) + INTERVAL 365 DAY
```

**Tasks:**
- [ ] Add feedback table creation to `init()`

### 4.4.3 Implement createScore

**File:** `stores/clickhouse/src/storage/domains/observability/index.ts` (modify)

```typescript
async createScore(args: CreateScoreArgs): Promise<void> {
  const { score } = args;

  await this.client.insert({
    table: 'mastra_ai_scores',
    values: [{
      Timestamp: score.timestamp.toISOString(),
      ScoreId: score.id,
      TraceId: score.traceId,
      SpanId: score.spanId ?? '',
      ScorerName: score.scorerName,
      Score: score.score,
      Reason: score.reason ?? '',
      Metadata: score.metadata ? JSON.stringify(score.metadata) : '',
      Experiment: score.experiment ?? '',
      OrganizationId: score.organizationId ?? '',
      UserId: score.userId ?? '',
      Environment: score.environment ?? '',
      ServiceName: score.serviceName ?? '',
    }],
    format: 'JSONEachRow',
  });
}
```

**Tasks:**
- [ ] Implement createScore

### 4.4.4 Implement listScores

```typescript
async listScores(args: ListScoresArgs): Promise<PaginatedResult<ScoreRecord>> {
  const { filters, pagination, orderBy } = args;

  let query = 'SELECT * FROM mastra_ai_scores WHERE 1=1';
  const params: Record<string, unknown> = {};

  if (filters?.traceId) {
    query += ' AND TraceId = {traceId:String}';
    params.traceId = filters.traceId;
  }
  if (filters?.scorerName) {
    const names = Array.isArray(filters.scorerName) ? filters.scorerName : [filters.scorerName];
    query += ' AND ScorerName IN ({scorerNames:Array(String)})';
    params.scorerNames = names;
  }
  if (filters?.experiment) {
    query += ' AND Experiment = {experiment:String}';
    params.experiment = filters.experiment;
  }

  const field = orderBy?.field === 'score' ? 'Score' : 'Timestamp';
  query += ` ORDER BY ${field} ${orderBy?.direction ?? 'DESC'}`;

  query += ` LIMIT {limit:UInt32} OFFSET {offset:UInt32}`;
  params.limit = pagination?.limit ?? 100;
  params.offset = pagination?.offset ?? 0;

  const result = await this.client.query({
    query,
    query_params: params,
    format: 'JSONEachRow',
  });

  const rows = await result.json<ClickHouseScoreRow[]>();

  return {
    data: rows.map(this.rowToScoreRecord.bind(this)),
    pagination: { total: await this.getScoreCount(filters), limit: params.limit, offset: params.offset },
  };
}
```

**Tasks:**
- [ ] Implement listScores with ClickHouse syntax

### 4.4.5 Implement createFeedback

```typescript
async createFeedback(args: CreateFeedbackArgs): Promise<void> {
  const { feedback } = args;

  await this.client.insert({
    table: 'mastra_ai_feedback',
    values: [{
      Timestamp: feedback.timestamp.toISOString(),
      FeedbackId: feedback.id,
      TraceId: feedback.traceId,
      SpanId: feedback.spanId ?? '',
      Source: feedback.source,
      FeedbackType: feedback.feedbackType,
      Value: String(feedback.value),
      Comment: feedback.comment ?? '',
      Experiment: feedback.experiment ?? '',
      UserId: feedback.userId ?? '',
      OrganizationId: feedback.organizationId ?? '',
      Environment: feedback.environment ?? '',
      ServiceName: feedback.serviceName ?? '',
      Metadata: feedback.metadata ? JSON.stringify(feedback.metadata) : '',
    }],
    format: 'JSONEachRow',
  });
}
```

**Tasks:**
- [ ] Implement createFeedback

### 4.4.6 Implement listFeedback

```typescript
async listFeedback(args: ListFeedbackArgs): Promise<PaginatedResult<FeedbackRecord>> {
  // Similar to listScores with ClickHouse syntax
}
```

**Tasks:**
- [ ] Implement listFeedback with ClickHouse syntax

### 4.4.7 Update Capabilities

```typescript
get capabilities(): StorageCapabilities {
  return {
    tracing: { /* existing */ },
    logs: { /* existing */ },
    metrics: { /* existing */ },
    scores: { supported: true },
    feedback: { supported: true },
  };
}
```

**Tasks:**
- [ ] Set scores capability
- [ ] Set feedback capability

### PR 4.4 Testing

**Tasks:**
- [ ] Test scores table creation
- [ ] Test createScore inserts correctly
- [ ] Test listScores with various filters
- [ ] Test feedback table creation
- [ ] Test createFeedback inserts correctly
- [ ] Test listFeedback with various filters

