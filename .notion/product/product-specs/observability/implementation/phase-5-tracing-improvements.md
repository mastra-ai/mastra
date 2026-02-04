# Phase 5: Tracing Improvements

**Status:** Planning
**Prerequisites:** Phase 1-4
**Estimated Scope:** SessionId support, unified ObservabilityConfig, deprecations

---

## Overview

Phase 5 completes the tracing improvements:
- SessionId support in TracingOptions and span schema
- Unified ObservabilityConfig on Mastra
- Deprecate top-level `logger` config with migration path

---

## Package Change Strategy

| PR | Package | Scope |
|----|---------|-------|
| PR 5.1 | `@mastra/core` | SessionId in TracingOptions, ObservabilityConfig type |
| PR 5.2 | `@mastra/observability` | SessionId propagation, config handling |
| PR 5.3 | `stores/duckdb` | SessionId in spans table |
| PR 5.4 | `stores/clickhouse` | SessionId in spans table |
| PR 5.5 | `@mastra/core` | Mastra config deprecations and migrations |

---

## PR 5.1: @mastra/core TracingOptions Updates

**Package:** `packages/core`
**Scope:** SessionId in TracingOptions, ObservabilityConfig type refinements

### 5.1.1 Update TracingOptions

**File:** `packages/core/src/observability/types/tracing.ts` (modify)

```typescript
export interface TracingOptions {
  // Existing
  runId?: string;
  threadId?: string;
  requestId?: string;

  // NEW: Multi-turn conversation grouping
  sessionId?: string;
}
```

**Tasks:**
- [ ] Add `sessionId` to TracingOptions
- [ ] Update JSDoc with usage guidance

### 5.1.2 Update Span Schema

**File:** `packages/core/src/observability/types/tracing.ts` (modify)

Ensure `sessionId` is in the span schema (should already exist, verify):

```typescript
export interface SpanRecord {
  // ... existing fields

  // Correlation
  runId?: string;
  sessionId?: string;    // Verify this exists
  threadId?: string;
  requestId?: string;

  // ...
}
```

**Tasks:**
- [ ] Verify sessionId is in SpanRecord
- [ ] Add if missing

### 5.1.3 Unified ObservabilityConfig

**File:** `packages/core/src/observability/types/config.ts` (modify)

```typescript
export interface ObservabilityConfig {
  // Identity
  serviceName: string;
  environment?: string;

  // Exporters
  exporters: ObservabilityExporter[];

  // Logging
  logLevel?: LogLevel;

  // Sampling
  sampling?: SamplingConfig;

  // Processors (sensitive data filtering, etc.)
  processors?: SignalProcessor[];

  // Metrics
  metrics?: MetricsConfig;

  // Multi-tenancy defaults
  organizationId?: string;
  userId?: string;

  // Session defaults (can be overridden per-trace)
  defaultSessionId?: string;
}
```

**Tasks:**
- [ ] Add `organizationId` and `userId` defaults
- [ ] Add `defaultSessionId` option
- [ ] Update JSDoc

### PR 5.1 Testing

**Tasks:**
- [ ] Verify TracingOptions accepts sessionId
- [ ] Verify ObservabilityConfig type is correct
- [ ] Verify backward compatibility

---

## PR 5.2: @mastra/observability SessionId Support

**Package:** `observability/mastra`
**Scope:** SessionId propagation through span creation

### 5.2.1 Update Span Creation

**File:** `observability/mastra/src/instances/base.ts` (modify)

```typescript
createSpan(name: string, options?: SpanOptions & TracingOptions): Span {
  const span = this.tracer.startSpan(name, {
    // ... existing options

    // Propagate sessionId from options or config default
    sessionId: options?.sessionId ?? this.config.defaultSessionId,
  });

  return span;
}
```

**Tasks:**
- [ ] Pass sessionId to span creation
- [ ] Fall back to config default

### 5.2.2 Update Context Propagation

**File:** `observability/mastra/src/context/propagation.ts` (modify if exists)

Ensure sessionId is propagated through context:

```typescript
export function extractContext(headers: Record<string, string>): TracingContext {
  // ... existing extraction

  return {
    traceId,
    spanId,
    sessionId: headers['x-mastra-session-id'],
  };
}

export function injectContext(context: TracingContext): Record<string, string> {
  return {
    // ... existing injection
    'x-mastra-session-id': context.sessionId ?? '',
  };
}
```

**Tasks:**
- [ ] Add sessionId to context extraction
- [ ] Add sessionId to context injection

### 5.2.3 Update Agent/Tool/Workflow Context

Ensure sessionId flows through to tool/workflow execution contexts:

**Tasks:**
- [ ] Verify sessionId available in ToolExecutionContext
- [ ] Verify sessionId available in WorkflowContext
- [ ] Verify sessionId included in LoggerContext

### PR 5.2 Testing

**Tasks:**
- [ ] Test sessionId propagates to child spans
- [ ] Test sessionId in logs
- [ ] Test context injection/extraction

---

## PR 5.3: DuckDB SessionId Support

**Package:** `stores/duckdb`
**Scope:** Ensure sessionId column exists and is indexed

### 5.3.1 Verify Spans Table

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (verify/modify)

The spans table should already have `session_id`. Verify:

```sql
CREATE TABLE IF NOT EXISTS mastra_ai_spans (
  -- ... existing columns
  session_id VARCHAR,  -- Verify exists
  -- ...
);

CREATE INDEX IF NOT EXISTS idx_spans_session_id ON mastra_ai_spans(session_id);
```

**Tasks:**
- [ ] Verify session_id column exists
- [ ] Add index on session_id for session-based queries

### 5.3.2 Update ListTraces Filter

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (modify)

```typescript
async listTraces(args: ListTracesArgs): Promise<PaginatedResult<SpanRecord>> {
  // ... existing filters

  if (filters?.sessionId) {
    query += ' AND session_id = ?';
    params.push(filters.sessionId);
  }
}
```

**Tasks:**
- [ ] Add sessionId filter to listTraces

### PR 5.3 Testing

**Tasks:**
- [ ] Test sessionId stored correctly
- [ ] Test filtering by sessionId

---

## PR 5.4: ClickHouse SessionId Support

**Package:** `stores/clickhouse`
**Scope:** Ensure sessionId column exists and is indexed

### 5.4.1 Verify Spans Table

The ClickHouse spans table should already have SessionId. Verify and add index:

```sql
-- Verify SessionId column exists
-- Add bloom filter index if not present
INDEX idx_session_id SessionId TYPE bloom_filter(0.01) GRANULARITY 1
```

**Tasks:**
- [ ] Verify SessionId column exists in spans table
- [ ] Add bloom filter index if needed

### 5.4.2 Update ListTraces Filter

```typescript
if (filters?.sessionId) {
  query += ' AND SessionId = {sessionId:String}';
  params.sessionId = filters.sessionId;
}
```

**Tasks:**
- [ ] Add sessionId filter to listTraces

### PR 5.4 Testing

**Tasks:**
- [ ] Test sessionId stored correctly
- [ ] Test filtering by sessionId

---

## PR 5.5: Mastra Config Deprecations

**Package:** `packages/core`
**Scope:** Deprecate top-level logger, provide migration path

### 5.5.1 Deprecate Top-Level Logger

**File:** `packages/core/src/mastra/types.ts` (modify)

```typescript
export interface MastraConfig {
  // ... existing config

  /**
   * @deprecated Use `observability.logLevel` instead.
   * This option will be removed in a future major version.
   */
  logger?: IMastraLogger | LogLevel;

  // NEW: Unified observability config
  observability?: ObservabilityConfig;
}
```

**Tasks:**
- [ ] Add JSDoc deprecation notice to `logger`
- [ ] Add `observability` config option
- [ ] Document migration path

### 5.5.2 Config Migration Logic

**File:** `packages/core/src/mastra/mastra.ts` (modify)

```typescript
constructor(config: MastraConfig) {
  // Handle deprecated logger config
  if (config.logger && !config.observability?.logLevel) {
    console.warn(
      '[Mastra] The `logger` config option is deprecated. ' +
      'Please use `observability.logLevel` instead.'
    );

    // Migrate logger config to observability
    this.observabilityConfig = {
      ...config.observability,
      logLevel: typeof config.logger === 'string'
        ? config.logger
        : this.inferLogLevel(config.logger),
    };
  } else {
    this.observabilityConfig = config.observability;
  }
}
```

**Tasks:**
- [ ] Add deprecation warning when using old logger config
- [ ] Migrate old config to new format
- [ ] Ensure backward compatibility

### 5.5.3 Update Documentation

**Tasks:**
- [ ] Document new ObservabilityConfig structure
- [ ] Document migration from `logger` to `observability.logLevel`
- [ ] Add migration guide

### PR 5.5 Testing

**Tasks:**
- [ ] Test old logger config still works (with warning)
- [ ] Test new observability config works
- [ ] Test migration logic
- [ ] Verify deprecation warning appears

---

## Integration Testing

After all PRs merged:

**Tasks:**
- [ ] E2E test: SessionId flows through agent → tool → storage
- [ ] E2E test: Query traces by sessionId
- [ ] E2E test: Query logs by sessionId
- [ ] E2E test: Old logger config works with deprecation warning
- [ ] E2E test: New observability config works

---

## Dependencies Between PRs

```
PR 5.1 (@mastra/core types)
    ↓
PR 5.2 (@mastra/observability) ← depends on core types
    ↓
PR 5.3 (stores/duckdb) ← can run in parallel with 5.4
    ↓
PR 5.4 (stores/clickhouse) ← can run in parallel with 5.3
    ↓
PR 5.5 (@mastra/core deprecations) ← after storage adapters
```

**Merge order:** 5.1 → 5.2 → (5.3 | 5.4) → 5.5

---

## Definition of Done

- [ ] SessionId supported in TracingOptions
- [ ] SessionId propagates through spans and logs
- [ ] SessionId indexed in storage for efficient queries
- [ ] Old logger config deprecated with warning
- [ ] New ObservabilityConfig on Mastra
- [ ] Migration guide documented
- [ ] All tests pass

---

## Migration Guide Outline

```markdown
# Migrating to Unified Observability Config

## Before (deprecated)

```typescript
const mastra = new Mastra({
  logger: 'debug',
  // or
  logger: createConsoleLogger('debug'),
});
```

## After

```typescript
const mastra = new Mastra({
  observability: {
    serviceName: 'my-app',
    environment: 'production',
    logLevel: 'debug',
    exporters: [/* ... */],
  },
});
```

## Key Changes

1. `logger` → `observability.logLevel`
2. Unified config for traces, metrics, and logs
3. Centralized exporter configuration
```

---

## Open Questions

1. Should we support runtime log level changes?
2. How long to maintain backward compatibility for `logger` config?
3. Should we auto-detect environment from NODE_ENV?
