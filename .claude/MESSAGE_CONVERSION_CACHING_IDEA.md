# Message Conversion Caching Idea

**Status:** Future enhancement - NOT part of current message format unification work

---

## Overview

Cache individual message conversions (per message, per format) to avoid repeated conversion overhead, especially for expensive operations like network data parsing.

---

## Key Insight

**Cache per-message conversions, not entire query results.**

This gives us:

- Simple cache keys (message ID + timestamp + format)
- Automatic invalidation (timestamp changes on edit)
- Reusability across queries
- Helps with pagination and overlapping queries

---

## Cache Key Design

```typescript
const cacheKey = `${message.id}-${message.updatedAt || message.createdAt}-${format}`;
```

**Why this works:**

1. ✅ **Unique identifier** - Message ID is already unique
2. ✅ **Automatic invalidation** - When message is edited, `updatedAt` changes → new cache key
3. ✅ **No manual invalidation needed** - Old cache entries naturally become stale and get evicted by LRU
4. ✅ **Reusable across queries** - Same message in different queries uses same cache entry

---

## Implementation

```typescript
// packages/core/src/agent/message-list/utils/conversion-cache.ts
import { LRU } from 'lru-cache';

const messageConversionCache = new LRU<string, unknown>({
  max: 10000,
  ttl: 1000 * 60 * 60, // 1 hour (optional, for extra safety)
});

export function getCachedConversion<T>(
  message: { id: string; createdAt: Date; updatedAt?: Date },
  format: MessageFormat,
  converter: () => T,
): T {
  const timestamp = message.updatedAt || message.createdAt;
  const cacheKey = `${message.id}-${timestamp.getTime()}-${format}`;

  if (messageConversionCache.has(cacheKey)) {
    return messageConversionCache.get(cacheKey) as T;
  }

  const converted = converter();
  messageConversionCache.set(cacheKey, converted);
  return converted;
}

// Optional: Clear entire cache (for testing or memory management)
export function clearConversionCache() {
  messageConversionCache.clear();
}

// Optional: Get cache stats (for monitoring)
export function getConversionCacheStats() {
  return {
    size: messageConversionCache.size,
    max: messageConversionCache.max,
    hitRate: messageConversionCache.calculatedSize / messageConversionCache.fetchMethod?.length || 0,
  };
}
```

---

## Usage in MessageList

```typescript
// packages/core/src/agent/message-list/index.ts
import { getCachedConversion } from './utils/conversion-cache';

class MessageList {
  // ...

  private convertMessageToV5(message: MastraMessageV2): UIMessage {
    return getCachedConversion(
      message,
      'aiv5-ui',
      () => this.performV5Conversion(message)
    );
  }

  get.all.v5() {
    return this.messages.map(msg => this.convertMessageToV5(msg));
  }
}
```

---

## Benefits

### 1. Performance Optimization

**Scenario: Pagination**

```typescript
// User loads last 10 messages
await memory.query({ threadId, selectBy: { last: 10 }, format: 'aiv5-ui' });
// Messages 1-10 converted and cached

// User scrolls up, loads last 20 messages
await memory.query({ threadId, selectBy: { last: 20 }, format: 'aiv5-ui' });
// Messages 1-10 already cached! Only convert 11-20
```

**Scenario: Overlapping queries**

```typescript
// Agent fetches last 5 messages for context
await memory.query({ threadId, selectBy: { last: 5 }, format: 'mastra-db' });

// Frontend fetches last 10 messages for UI
await memory.query({ threadId, selectBy: { last: 10 }, format: 'aiv5-ui' });
// First 5 messages already converted to mastra-db, reused for aiv5-ui conversion
```

### 2. Network Data Parsing

Network data is embedded in message text and parsed during conversion to `aiv5-ui`:

```typescript
// This parsing happens during conversion
const networkData = JSON.parse(message.content.find(p => p.text.includes('isNetwork')));
```

**Caching the converted message caches the parsed network data too!** This is the expensive part.

### 3. Automatic Cache Invalidation

When a message is edited:

```typescript
// Message before edit
{ id: 'msg-1', createdAt: '2024-01-01T00:00:00Z', updatedAt: null, content: 'Hello' }
// Cache key: msg-1-1704067200000-aiv5-ui

// Message after edit
{ id: 'msg-1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T01:00:00Z', content: 'Hello World' }
// Cache key: msg-1-1704070800000-aiv5-ui (different!)
```

Old cache entry is automatically stale. No manual invalidation needed.

### 4. Memory Bounded

```typescript
const messageConversionCache = new LRU<string, unknown>({
  max: 10000,
  ttl: 1000 * 60 * 60, // 1 hour
});
```

**Calculation:**

- 10k messages × 5 formats = 50k max entries
- Average converted message size: ~2KB
- Max memory: ~100MB

**LRU eviction ensures:**

- Least recently used entries are evicted first
- Memory usage stays bounded
- Hot messages (frequently accessed) stay cached

---

## Global vs Instance Cache

**Decision: Global cache (singleton)**

```typescript
// Shared across all MessageList instances
const messageConversionCache = new LRU<string, unknown>(10000);
```

**Why global?**

1. ✅ Same message converted once, reused everywhere
2. ✅ Helps with pagination (messages appear in multiple pages)
3. ✅ Helps with overlapping queries (different queries, same messages)
4. ✅ Memory bounded by LRU size

**Why not per-instance?**

- ❌ Cache is lost when MessageList is garbage collected
- ❌ Most MessageList instances are short-lived (created per request)
- ❌ Doesn't help with repeated queries (new MessageList each time)

---

## When to Implement

**Not now because:**

1. Premature optimization - we haven't measured conversion performance yet
2. Adds complexity to the codebase
3. Current work is focused on format unification, not performance

**Implement later if:**

1. Performance benchmarks show conversion is slow (>100ms for typical queries)
2. Production metrics show repeated conversions of same messages
3. Network data parsing becomes a bottleneck
4. Users report slow query performance

---

## Action Items (Future)

1. **Add performance benchmarks** to test suite:
   - Measure conversion time for 100, 1k, 10k messages
   - Measure network data parsing overhead
   - Compare with/without caching

2. **Monitor production metrics** after format unification release:
   - Query latency (p50, p95, p99)
   - Conversion time
   - Cache hit rate (if implemented)

3. **Implement caching if needed**:
   - Add `conversion-cache.ts` utility
   - Update `MessageList` to use cached conversions
   - Add cache stats endpoint for monitoring
   - Document cache behavior

---

## Open Questions

### 1. Should we cache all formats or just expensive ones?

**Option A:** Cache all formats

- Pro: Consistent behavior
- Con: More memory usage

**Option B:** Cache only `aiv5-ui` (has network data parsing)

- Pro: Less memory usage
- Con: Inconsistent behavior

**Recommendation:** Start with all formats, measure memory usage

### 2. Should TTL be configurable?

```typescript
const messageConversionCache = new LRU<string, unknown>({
  max: process.env.MESSAGE_CACHE_SIZE || 10000,
  ttl: process.env.MESSAGE_CACHE_TTL || 1000 * 60 * 60,
});
```

**Recommendation:** Make configurable for flexibility

### 3. Should we expose cache stats?

```typescript
// GET /api/internal/cache/stats
{
  "messageConversion": {
    "size": 5432,
    "max": 10000,
    "hitRate": 0.85,
    "memoryUsage": "45MB"
  }
}
```

**Recommendation:** Yes, for monitoring and debugging

---

## Related Work

- Message format unification plan (`.claude/MESSAGE_FORMAT_UNIFICATION.md`)
- Performance test suite (to be added)
- Production monitoring (to be added)

---

## Summary

**Per-message caching with date-based cache keys is a clean, effective solution for optimizing message conversions.**

Key benefits:

- ✅ Automatic invalidation (no manual cache management)
- ✅ Reusable across queries (pagination, overlapping queries)
- ✅ Memory bounded (LRU eviction)
- ✅ Simple implementation (single utility function)

**But it's not needed right now.** We should:

1. Complete format unification first
2. Add performance benchmarks
3. Measure in production
4. Implement caching only if needed

---

**Status:** Documented for future reference, not part of current work.
