## PR 2.1: @mastra/core Changes

**Package:** `packages/core`
**Scope:** LogRecord schema, storage interface extensions

### 2.1.1 LogRecord Schema

**File:** `packages/core/src/observability/types/logs.ts` (new)

```typescript
import { z } from 'zod';

export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'fatal']);
export type LogLevel = z.infer<typeof logLevelSchema>;

export const logRecordSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  level: logLevelSchema,
  message: z.string(),
  data: z.record(z.unknown()).optional(),

  // Correlation (auto-captured from trace context)
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  runId: z.string().optional(),
  sessionId: z.string().optional(),
  threadId: z.string().optional(),
  requestId: z.string().optional(),

  // Entity context (auto-captured)
  entityType: z.string().optional(),
  entityName: z.string().optional(),

  // Multi-tenancy
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  resourceId: z.string().optional(),

  // Environment (from config)
  environment: z.string().optional(),
  serviceName: z.string().optional(),
  source: z.string().optional(),

  // Filtering
  tags: z.array(z.string()).optional(),
});

export type LogRecord = z.infer<typeof logRecordSchema>;

export interface LogRecordInput {
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  tags?: string[];
}
```

**Tasks:**
- [ ] Define logLevelSchema enum
- [ ] Define logRecordSchema with all fields
- [ ] Define LogRecordInput for user-facing API
- [ ] Export from types index

### 2.1.2 Storage Interface Extensions

**File:** `packages/core/src/storage/domains/observability/base.ts` (modify)

```typescript
// Add to ObservabilityStorage abstract class

// === Logs ===
async batchCreateLogs(args: BatchCreateLogsArgs): Promise<void> {
  throw new Error('Not implemented');
}

async listLogs(args: ListLogsArgs): Promise<PaginatedResult<LogRecord>> {
  throw new Error('Not implemented');
}

// Types
export interface BatchCreateLogsArgs {
  logs: LogRecord[];
}

export interface ListLogsArgs {
  filters?: {
    traceId?: string;
    spanId?: string;
    runId?: string;
    sessionId?: string;
    level?: LogLevel | LogLevel[];
    entityType?: string;
    entityName?: string;
    userId?: string;
    organizationId?: string;
    serviceName?: string;
    environment?: string;
    startTime?: Date;
    endTime?: Date;
    search?: string;  // full-text search on message
    tags?: string[];
    dataKeys?: string[];  // filter logs that have specific data keys
  };
  pagination?: {
    limit?: number;
    offset?: number;
    cursor?: string;
  };
  orderBy?: {
    field: 'timestamp';
    direction: 'asc' | 'desc';
  };
}
```

**Tasks:**
- [ ] Add `batchCreateLogs()` method
- [ ] Add `listLogs()` method
- [ ] Define BatchCreateLogsArgs interface
- [ ] Define ListLogsArgs interface with filters
- [ ] Update capabilities type for logs support

### 2.1.3 Update StorageCapabilities

**File:** `packages/core/src/storage/domains/observability/types.ts` (modify)

```typescript
// Add LogsStorageStrategy type (if not already added in Phase 1)
export type LogsStorageStrategy = 'realtime' | 'batch';
```

**File:** `packages/core/src/storage/domains/observability/base.ts` (modify)

The `logsStrategy` getter is already defined in Phase 1 (returns `null` by default). No changes needed here - subclasses override to declare support.

**Tasks:**
- [ ] Verify LogsStorageStrategy type exists

### PR 2.1 Testing

**Tasks:**
- [ ] Test LogRecord schema validation
- [ ] Test schema accepts valid records
- [ ] Test schema rejects invalid records
- [ ] Verify type exports

