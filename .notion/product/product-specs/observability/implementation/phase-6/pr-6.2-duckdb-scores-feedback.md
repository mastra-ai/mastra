## PR 4.3: DuckDB Scores/Feedback Support

**Package:** `stores/duckdb`
**Scope:** Scores and Feedback tables and methods

### 4.3.1 Scores Table Schema

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (modify)

```sql
CREATE TABLE IF NOT EXISTS mastra_ai_scores (
  id VARCHAR PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,

  -- Target
  trace_id VARCHAR NOT NULL,
  span_id VARCHAR,

  -- Score data
  scorer_name VARCHAR NOT NULL,
  score DOUBLE NOT NULL,
  reason TEXT,
  metadata JSON,
  experiment VARCHAR,

  -- Multi-tenancy
  organization_id VARCHAR,
  user_id VARCHAR,

  -- Environment
  environment VARCHAR,
  service_name VARCHAR
);

CREATE INDEX IF NOT EXISTS idx_scores_trace_id ON mastra_ai_scores(trace_id);
CREATE INDEX IF NOT EXISTS idx_scores_span_id ON mastra_ai_scores(span_id);
CREATE INDEX IF NOT EXISTS idx_scores_scorer ON mastra_ai_scores(scorer_name);
CREATE INDEX IF NOT EXISTS idx_scores_experiment ON mastra_ai_scores(experiment);
CREATE INDEX IF NOT EXISTS idx_scores_timestamp ON mastra_ai_scores(timestamp DESC);
```

**Tasks:**
- [ ] Add scores table creation to `init()`
- [ ] Create indexes

### 4.3.2 Feedback Table Schema

```sql
CREATE TABLE IF NOT EXISTS mastra_ai_feedback (
  id VARCHAR PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,

  -- Target
  trace_id VARCHAR NOT NULL,
  span_id VARCHAR,

  -- Feedback data
  source VARCHAR NOT NULL,
  feedback_type VARCHAR NOT NULL,
  value VARCHAR NOT NULL,  -- Store as string, parse on read
  comment TEXT,
  experiment VARCHAR,

  -- Attribution
  user_id VARCHAR,

  -- Multi-tenancy
  organization_id VARCHAR,

  -- Environment
  environment VARCHAR,
  service_name VARCHAR,

  -- Extra
  metadata JSON
);

CREATE INDEX IF NOT EXISTS idx_feedback_trace_id ON mastra_ai_feedback(trace_id);
CREATE INDEX IF NOT EXISTS idx_feedback_span_id ON mastra_ai_feedback(span_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON mastra_ai_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_experiment ON mastra_ai_feedback(experiment);
CREATE INDEX IF NOT EXISTS idx_feedback_timestamp ON mastra_ai_feedback(timestamp DESC);
```

**Tasks:**
- [ ] Add feedback table creation to `init()`
- [ ] Create indexes

### 4.3.3 Implement createScore

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (modify)

```typescript
async createScore(args: CreateScoreArgs): Promise<void> {
  const { score } = args;

  const stmt = this.db.prepare(`
    INSERT INTO mastra_ai_scores (
      id, timestamp, trace_id, span_id,
      scorer_name, score, reason, metadata, experiment,
      organization_id, user_id, environment, service_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    score.id,
    score.timestamp.toISOString(),
    score.traceId,
    score.spanId ?? null,
    score.scorerName,
    score.score,
    score.reason ?? null,
    score.metadata ? JSON.stringify(score.metadata) : null,
    score.experiment ?? null,
    score.organizationId ?? null,
    score.userId ?? null,
    score.environment ?? null,
    score.serviceName ?? null,
  );
}
```

**Tasks:**
- [ ] Implement createScore

### 4.3.4 Implement listScores

```typescript
async listScores(args: ListScoresArgs): Promise<PaginatedResult<ScoreRecord>> {
  const { filters, pagination, orderBy } = args;

  let query = 'SELECT * FROM mastra_ai_scores WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.traceId) {
    query += ' AND trace_id = ?';
    params.push(filters.traceId);
  }
  if (filters?.spanId) {
    query += ' AND span_id = ?';
    params.push(filters.spanId);
  }
  if (filters?.scorerName) {
    const names = Array.isArray(filters.scorerName) ? filters.scorerName : [filters.scorerName];
    query += ` AND scorer_name IN (${names.map(() => '?').join(', ')})`;
    params.push(...names);
  }
  if (filters?.experiment) {
    query += ' AND experiment = ?';
    params.push(filters.experiment);
  }
  // ... more filters

  const order = orderBy?.direction ?? 'desc';
  const field = orderBy?.field === 'score' ? 'score' : 'timestamp';
  query += ` ORDER BY ${field} ${order}`;

  const limit = pagination?.limit ?? 100;
  const offset = pagination?.offset ?? 0;
  query += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = this.db.prepare(query).all(...params);

  return {
    data: rows.map(this.rowToScoreRecord),
    pagination: { total: this.getScoreCount(filters), limit, offset },
  };
}
```

**Tasks:**
- [ ] Implement listScores with filters
- [ ] Support ordering by score or timestamp

### 4.3.5 Implement createFeedback

```typescript
async createFeedback(args: CreateFeedbackArgs): Promise<void> {
  const { feedback } = args;

  const stmt = this.db.prepare(`
    INSERT INTO mastra_ai_feedback (
      id, timestamp, trace_id, span_id,
      source, feedback_type, value, comment, experiment,
      user_id, organization_id, environment, service_name, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    feedback.id,
    feedback.timestamp.toISOString(),
    feedback.traceId,
    feedback.spanId ?? null,
    feedback.source,
    feedback.feedbackType,
    String(feedback.value),  // Store as string
    feedback.comment ?? null,
    feedback.experiment ?? null,
    feedback.userId ?? null,
    feedback.organizationId ?? null,
    feedback.environment ?? null,
    feedback.serviceName ?? null,
    feedback.metadata ? JSON.stringify(feedback.metadata) : null,
  );
}
```

**Tasks:**
- [ ] Implement createFeedback

### 4.3.6 Implement listFeedback

```typescript
async listFeedback(args: ListFeedbackArgs): Promise<PaginatedResult<FeedbackRecord>> {
  const { filters, pagination, orderBy } = args;

  let query = 'SELECT * FROM mastra_ai_feedback WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.traceId) {
    query += ' AND trace_id = ?';
    params.push(filters.traceId);
  }
  if (filters?.feedbackType) {
    const types = Array.isArray(filters.feedbackType) ? filters.feedbackType : [filters.feedbackType];
    query += ` AND feedback_type IN (${types.map(() => '?').join(', ')})`;
    params.push(...types);
  }
  if (filters?.experiment) {
    query += ' AND experiment = ?';
    params.push(filters.experiment);
  }
  // ... more filters

  query += ` ORDER BY timestamp ${orderBy?.direction ?? 'desc'}`;

  const limit = pagination?.limit ?? 100;
  const offset = pagination?.offset ?? 0;
  query += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = this.db.prepare(query).all(...params);

  return {
    data: rows.map(this.rowToFeedbackRecord),
    pagination: { total: this.getFeedbackCount(filters), limit, offset },
  };
}
```

**Tasks:**
- [ ] Implement listFeedback with filters

### 4.3.7 Update Capabilities

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

### PR 4.3 Testing

**Tasks:**
- [ ] Test scores table creation
- [ ] Test createScore inserts correctly
- [ ] Test listScores with various filters
- [ ] Test feedback table creation
- [ ] Test createFeedback inserts correctly
- [ ] Test listFeedback with various filters

