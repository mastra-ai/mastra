# Observational Memory Storage Adapter Implementation Plan

## Overview

This document outlines the plan for implementing Observational Memory (OM) support across Mastra's storage adapters. OM is **not a breaking change** - all methods are optional and throw "not implemented" by default, only requiring implementation if OM is used with a specific adapter.

## Current State

### Reference Implementation
- **`InMemoryMemory`** (`packages/core/src/storage/domains/memory/inmemory.ts`): Full 881-line reference implementation of all OM methods
- **`PersistableInMemoryMemory`** (`explorations/longmemeval/src/storage/persistable-inmemory-memory.ts`): Extends InMemoryMemory with disk persistence for benchmarking

### Storage Adapters Requiring Implementation
All 22 adapters in `stores/` need OM method implementations:

| Adapter | Priority | Complexity | Notes |
|---------|----------|------------|-------|
| `pg` (PostgreSQL) | **HIGH** | Medium | Most common production DB |
| `mongodb` | **HIGH** | Medium | Popular NoSQL option |
| `clickhouse` | **HIGH** | Medium | Already used in LongMemEval testing |
| `dynamodb` | Medium | High | AWS native, complex queries |
| `redis` | Medium | Medium | Fast caching layer |
| `sqlite` | Medium | Low | Good for local dev |
| `cloudflare-d1` | Medium | Medium | Edge deployment |
| `turso` | Medium | Low | SQLite-compatible |
| `upstash` | Medium | Medium | Serverless Redis |
| `lance` | Low | High | Vector-focused |
| `chroma` | Low | High | Vector-focused |
| `opensearch` | Low | High | Search-focused |
| `pinecone` | Low | High | Vector-focused |
| `qdrant` | Low | High | Vector-focused |
| `astra` | Low | Medium | Cassandra-based |
| `neon` | Low | Low | PostgreSQL-compatible |
| `supabase` | Low | Low | PostgreSQL-compatible |
| `xata` | Low | Medium | Serverless Postgres |
| `libsql` | Low | Low | SQLite-compatible |
| `vercel-kv` | Low | Medium | Serverless KV |
| `vercel-postgres` | Low | Low | PostgreSQL-compatible |
| `weaviate` | Low | High | Vector-focused |

## OM Methods to Implement

From `packages/memory/src/experiments/observational-memory/observational-memory.ts`:

### Core OM Record Methods
```typescript
// Initialize/Get OM record for a resource
initializeObservationalMemory(resourceId: string): Promise<ObservationalMemoryRecord>
getObservationalMemory(resourceId: string): Promise<ObservationalMemoryRecord | null>
getObservationalMemoryHistory(resourceId: string): Promise<ObservationalMemoryRecord[]>
clearObservationalMemory(resourceId: string): Promise<void>
```

### Observation Management
```typescript
updateActiveObservations(resourceId: string, observations: string, tokenCount: number, version: number): Promise<boolean>
updateBufferedObservations(resourceId: string, observations: string): Promise<void>
addPendingMessageTokens(resourceId: string, threadId: string, tokenCount: number): Promise<void>
```

### Reflection Management
```typescript
createReflectionGeneration(resourceId: string, reflectedObservations: string, version: number): Promise<ObservationalMemoryRecord>
updateBufferedReflection(resourceId: string, reflection: string): Promise<void>
```

### Thread Management
```typescript
getThreadById(threadId: string): Promise<Thread | null>
listThreadsByResourceId(resourceId: string): Promise<Thread[]>
updateThread(threadId: string, updates: Partial<Thread>): Promise<void>
```

### Message Management
```typescript
listMessages(options: { threadId?: string; resourceId?: string; before?: Date; after?: Date; limit?: number }): Promise<MastraDBMessage[]>
markMessagesAsBuffering(messageIds: string[]): Promise<void>
```

### Concurrency Control
```typescript
setObservingFlag(resourceId: string, isObserving: boolean): Promise<void>
setReflectingFlag(resourceId: string, isReflecting: boolean): Promise<void>
```

## Data Schema Requirements

### ObservationalMemoryRecord
```typescript
interface ObservationalMemoryRecord {
  id: string;
  resourceId: string;
  activeObservations: string;
  observationTokenCount: number;
  bufferedObservations: string;
  bufferedReflection: string;
  pendingMessageTokens: Record<string, number>; // threadId -> tokenCount
  patterns: string;
  isObserving: boolean;
  isReflecting: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Thread Metadata Extension
```typescript
interface ThreadOMMetadata {
  currentTask?: string;
  suggestedResponse?: string;
  lastObservedAt?: Date;
  lastReflectedAt?: Date;
}
```

## Implementation Strategy

### Phase 1: High-Priority SQL Adapters
**Target: PostgreSQL, ClickHouse, SQLite**

1. **Create migration/schema for OM tables:**
   - `observational_memory_records` table
   - Add OM metadata columns to `threads` table
   - Indexes for `resourceId`, `version`, `createdAt`

2. **Implement methods following InMemoryMemory pattern:**
   - Use transactions for optimistic locking (`updateActiveObservations`)
   - Use JSON columns for `pendingMessageTokens` and `patterns`
   - Implement proper date filtering for `listMessages`

3. **Testing:**
   - Port existing OM unit tests to use each adapter
   - Verify optimistic locking works correctly
   - Test concurrent observation/reflection scenarios

### Phase 2: NoSQL Adapters
**Target: MongoDB, DynamoDB, Redis**

1. **MongoDB:**
   - Use embedded documents for OM record
   - Leverage MongoDB's atomic update operators
   - Use `$inc` for version increments

2. **DynamoDB:**
   - Design partition/sort key strategy for OM records
   - Use conditional writes for optimistic locking
   - Consider GSI for `resourceId` queries

3. **Redis:**
   - Use Hash for OM record fields
   - Use WATCH/MULTI for optimistic locking
   - Consider TTL for buffered data

### Phase 3: PostgreSQL-Compatible Adapters
**Target: Neon, Supabase, Vercel Postgres, Turso (SQLite)**

These can largely reuse the PostgreSQL implementation with minor adjustments.

### Phase 4: Vector/Search Adapters
**Target: Chroma, Lance, Pinecone, Qdrant, OpenSearch, Weaviate**

These are lower priority as they're primarily for vector search, not general storage. May need hybrid approach:
- Store OM records in a separate SQL/NoSQL store
- Use vector store only for semantic search on observations

## Testing Strategy

### Unit Tests
- Port `packages/memory/src/experiments/observational-memory/__tests__/` to each adapter
- Key test scenarios:
  - Basic CRUD for OM records
  - Optimistic locking (concurrent updates)
  - Thread metadata updates
  - Message listing with date filters
  - Reflection generation creates new record

### Integration Tests
- Run LongMemEval subset with each adapter
- Verify observation/reflection flow works end-to-end
- Check performance characteristics

### Benchmarks
- Compare adapter performance on:
  - OM record read/write latency
  - Message listing with large datasets
  - Concurrent observation handling

## Implementation Order

1. **PostgreSQL** (reference SQL implementation)
2. **ClickHouse** (already used in LongMemEval)
3. **MongoDB** (reference NoSQL implementation)
4. **SQLite** (local development)
5. **Redis** (caching scenarios)
6. **DynamoDB** (AWS users)
7. PostgreSQL-compatible adapters (reuse pg implementation)
8. Vector adapters (as needed)

## Estimated Effort

| Phase | Adapters | Estimated Time |
|-------|----------|----------------|
| Phase 1 | pg, clickhouse, sqlite | 2-3 days |
| Phase 2 | mongodb, dynamodb, redis | 2-3 days |
| Phase 3 | neon, supabase, vercel-postgres, turso | 1 day |
| Phase 4 | Vector adapters | 2-3 days (if needed) |
| Testing | All adapters | 2-3 days |

**Total: ~10-15 days**

## Open Questions

1. **Should vector adapters support OM?**
   - They're designed for semantic search, not general storage
   - Could use hybrid approach (SQL for OM, vector for search)

2. **Should we create a shared SQL migration package?**
   - Many adapters use similar SQL schemas
   - Could reduce duplication

3. **How to handle adapters without transaction support?**
   - Some adapters may not support atomic operations
   - May need to document limitations

4. **Should OM methods be in a separate interface?**
   - Currently mixed with base MemoryStorage
   - Could create `ObservationalMemoryStorage` interface

## Next Steps

1. [ ] Review and approve this plan
2. [ ] Start with PostgreSQL implementation
3. [ ] Create shared test suite for OM methods
4. [ ] Implement remaining high-priority adapters
5. [ ] Document OM setup for each adapter
