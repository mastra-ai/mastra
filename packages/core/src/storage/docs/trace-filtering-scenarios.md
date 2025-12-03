# Trace Filtering Scenarios

This document describes the different search and filtering scenarios we want to support for observability traces.

## Current Schema Fields

### First-Class Span Fields (Direct Column Filtering)

| Field          | Type     | Description                                                |
| -------------- | -------- | ---------------------------------------------------------- |
| `traceId`      | string   | Unique trace identifier                                    |
| `spanId`       | string   | Unique span identifier                                     |
| `parentSpanId` | string?  | Parent span reference (null = root span)                   |
| `name`         | string   | Span name                                                  |
| `spanType`     | SpanType | AGENT_RUN, WORKFLOW_RUN, TOOL_CALL, MODEL_GENERATION, etc. |

#### Entity Identification

| Field        | Type    | Description                                               |
| ------------ | ------- | --------------------------------------------------------- |
| `entityType` | string? | 'agent' \| 'workflow' \| 'tool' \| 'network' \| 'step'    |
| `entityId`   | string? | ID/name of entity (e.g., 'weatherAgent', 'orderWorkflow') |
| `entityName` | string? | Human-readable display name                               |

#### Identity & Tenancy

| Field            | Type    | Description                                            |
| ---------------- | ------- | ------------------------------------------------------ |
| `userId`         | string? | Human end-user who triggered the trace                 |
| `organizationId` | string? | Multi-tenant organization/account                      |
| `resourceId`     | string? | Broader resource context (Mastra memory compatibility) |

#### Correlation IDs

| Field       | Type    | Description                         |
| ----------- | ------- | ----------------------------------- |
| `runId`     | string? | Unique execution run identifier     |
| `sessionId` | string? | Session for grouping traces         |
| `threadId`  | string? | Conversation thread identifier      |
| `requestId` | string? | HTTP request ID for log correlation |

#### Deployment Context

| Field          | Type    | Description                                |
| -------------- | ------- | ------------------------------------------ |
| `environment`  | string? | 'production' \| 'staging' \| 'development' |
| `source`       | string? | 'local' \| 'cloud' \| 'ci'                 |
| `serviceName`  | string? | Name of the service                        |
| `deploymentId` | string? | Specific deployment/release identifier     |

#### Timestamps

| Field       | Type       | Description                      |
| ----------- | ---------- | -------------------------------- |
| `startedAt` | timestamp  | When span started                |
| `endedAt`   | timestamp? | When span ended (null = running) |
| `createdAt` | timestamp  | Database record creation time    |
| `updatedAt` | timestamp? | Database record last update time |

### Span Data Fields (JSONB)

| Field         | Type      | Description                                                  |
| ------------- | --------- | ------------------------------------------------------------ |
| `attributes`  | object?   | Span-type specific attributes (e.g., model, tokens, tools)   |
| `metadata`    | object?   | User-defined metadata for custom filtering                   |
| `tags`        | string[]? | Labels for categorization and filtering                      |
| `links`       | object?   | References to related spans in other traces                  |
| `input`       | any?      | Input data passed to the span                                |
| `output`      | any?      | Output data returned from the span                           |
| `error`       | object?   | Error information (presence indicates failure)               |
| `scope`       | object?   | Mastra package versions {"core": "1.0.0", "memory": "1.0.0"} |
| `versionInfo` | object?   | App version info {"app": "1.0.0", "gitSha": "abc123"}        |

### Derived Fields (Not Stored)

| Field           | Derived From             | Values                                                                     |
| --------------- | ------------------------ | -------------------------------------------------------------------------- |
| `status`        | `error` + `endedAt`      | 'error' (has error), 'running' (no endedAt), 'success' (endedAt, no error) |
| `hasChildError` | child spans with `error` | true if any child span in the trace has an error (even if root succeeded)  |

---

## Filtering Scenarios

### 1. Basic Root Span Filters

Filter traces by properties of the root span (where `parentSpanId IS NULL`).

**Examples:**

```typescript
// Find all traces for a specific agent
getTraces({
  filters: {
    entityType: 'agent',
    entityId: 'weatherAgent',
  },
});

// Find all failed traces (root span has error)
getTraces({
  filters: {
    status: 'error',
  },
});

// Find traces where any child span had an error (even if root succeeded)
getTraces({
  filters: {
    hasChildError: true,
  },
});

// Find traces with specific tags
getTraces({
  filters: {
    tags: ['production', 'high-priority'],
  },
});
```

### 2. Date Range Filters

Filter traces by execution time.

```typescript
getTraces({
  pagination: {
    dateRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
    },
  },
});
```

### 3. Identity & Tenancy Filters

Filter traces by user, organization, or resource.

```typescript
// Find all traces for a user
getTraces({
  filters: {
    userId: 'user-123',
  },
});

// Find all traces for an organization
getTraces({
  filters: {
    organizationId: 'org-acme',
  },
});
```

### 4. Correlation ID Filters

Filter traces by correlation identifiers.

```typescript
// Find all traces in a conversation
getTraces({
  filters: {
    threadId: 'thread-456',
  },
});

// Find all traces in a session
getTraces({
  filters: {
    sessionId: 'session-789',
  },
});

// Find traces for a specific HTTP request
getTraces({
  filters: {
    requestId: 'req-abc123',
  },
});
```

### 5. Deployment Context Filters

Filter traces by deployment information.

```typescript
// Find production traces from cloud
getTraces({
  filters: {
    environment: 'production',
    source: 'cloud',
  },
});

// Find traces from a specific service
getTraces({
  filters: {
    serviceName: 'chat-api',
  },
});

// Find traces from a specific deployment
getTraces({
  filters: {
    deploymentId: 'deploy-2024-01-15',
  },
});
```

### 6. JSONB Filters

Filter by key-value pairs in JSONB fields.

```typescript
// Find traces with specific metadata
getTraces({
  filters: {
    metadata: {
      experimentId: 'exp-123',
      customerId: 'acme-corp',
    },
  },
});

// Find traces from specific Mastra version
getTraces({
  filters: {
    scope: {
      core: '1.0.0',
    },
  },
});

// Find traces from specific app version
getTraces({
  filters: {
    versionInfo: {
      app: '2.3.1',
    },
  },
});
```

---

## Advanced Filtering Scenarios (Future)

### 7. Contains Child Span Filter

**Goal:** Find traces that contain a child span matching specific criteria.

> **Note:** The `hasChildError` filter is already supported (see Basic Root Span Filters above).
> The more general `containsSpan` filter below is planned for future implementation.

**Examples:**

```typescript
// Find traces that used a specific tool
getTraces({
  filters: {
    containsSpan: {
      entityType: 'tool',
      entityId: 'getWeather',
    },
  },
});

// Find traces that invoked a sub-agent
getTraces({
  filters: {
    containsSpan: {
      entityType: 'agent',
      entityName: 'Research Agent',
    },
  },
});
```

**SQL Implementation:**

```sql
SELECT DISTINCT t.* FROM spans t
WHERE t.parentSpanId IS NULL
  AND EXISTS (
    SELECT 1 FROM spans c
    WHERE c.traceId = t.traceId
      AND c.entityType = 'tool'
      AND c.entityId = 'getWeather'
  )
```

### 8. Performance Filters

**Goal:** Find traces based on duration or token usage.

```typescript
getTraces({
  filters: {
    duration: { gt: 5000 }, // > 5 seconds
    totalTokens: { gt: 10000 },
  },
});
```

### 9. Scorer/Evaluation Filters

**Goal:** Find traces based on evaluation scores (via scorers table JOIN).

```typescript
getTraces({
  filters: {
    scores: {
      scorerId: 'quality-scorer',
      range: { min: 0.0, max: 0.5 },
    },
  },
});
```

### 10. Full-Text Search

**Goal:** Search across input/output content.

```typescript
getTraces({
  filters: {
    search: {
      fields: ['input', 'output'],
      query: 'weather forecast',
    },
  },
});
```

---

## Filter Operators (Future)

For more expressive filtering, support operators beyond equality:

| Operator    | Description    | Example                                  |
| ----------- | -------------- | ---------------------------------------- |
| `eq`        | Equals         | `status: { eq: 'error' }`                |
| `ne`        | Not equals     | `environment: { ne: 'development' }`     |
| `in`        | In array       | `entityId: { in: ['agent1', 'agent2'] }` |
| `notIn`     | Not in array   | `status: { notIn: ['running'] }`         |
| `contains`  | Array contains | `tags: { contains: 'production' }`       |
| `gt`, `gte` | Greater than   | `duration: { gt: 5000 }`                 |
| `lt`, `lte` | Less than      | `startedAt: { lt: new Date() }`          |
| `like`      | Pattern match  | `name: { like: 'workflow%' }`            |
| `exists`    | Field exists   | `error: { exists: true }`                |

---

## Priority Order

1. **P0 (Current):** Basic filters on all first-class columns, `hasChildError` filter
2. **P1 (Next):** General `containsSpan` filter (find traces containing specific child spans)
3. **P2:** Scorer/evaluation filters (JOIN with scorers table)
4. **P3:** Performance filters (duration, tokens)
5. **P4:** Filter operators (gt, lt, in, etc.)
6. **P5:** Full-text search, query language
