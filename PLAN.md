# Durable Agent POC - Implementation Plan

## Overview

This branch implements durable execution patterns for Mastra agents with resumable streams. The goal is to allow agents to survive crashes and clients to reconnect without missing events.

**Key Concepts:**
- **Durable Execution** - Agentic loop runs on workflow engine, survives crashes
- **Resumable Streams** - Client can disconnect/reconnect without missing events

---

## Completed Work

### CachingPubSub & Resumable Streams
- [x] `CachingPubSub` decorator wrapping PubSub + MastraServerCache
- [x] Extended `PubSub` interface with `getHistory()` and `subscribeWithReplay()`
- [x] `createDurableAgent()` factory function
- [x] `DurableAgent` uses CachingPubSub by default
- [x] Stream adapter uses `subscribeWithReplay()`

### Redis Cache Infrastructure
- [x] `@mastra/redis` package with generic `RedisServerCache`
- [x] Works with any Redis client (ioredis, node-redis, @upstash/redis)
- [x] Presets: `upstashPreset`, `nodeRedisPreset`
- [x] `@mastra/upstash` updated to use `@mastra/redis`

---

## Remaining Work

### 1. Wire Caching into Evented/Inngest Agents

**Priority:** High - **COMPLETED**

`createEventedAgent` and `createInngestAgent` now support CachingPubSub for resumable streams.

**Files:**
- `packages/core/src/agent/durable/create-evented-agent.ts`
- `workflows/inngest/src/durable-agent/create-inngest-agent.ts`

**Tasks:**
- [x] Add `cache` option to `CreateEventedAgentOptions`
- [x] Wrap pubsub with CachingPubSub when cache provided
- [x] Add `cache` option to `CreateInngestAgentOptions`
- [x] Update Inngest agent to use CachingPubSub

---

### 2. Server Workflow Handlers Migration

**Priority:** Medium - **DEFERRED**

The server currently has manual cache calls for workflow event streaming. These could use CachingPubSub instead, but this is a larger architectural change.

**File:** `packages/server/src/server/handlers/workflows.ts`

**Current approach:** Direct streaming with manual `listPush` calls:
- Lines ~384, ~442, ~1037, ~1136: `serverCache.listPush(cacheKey, chunk)`

**Migration considerations:**
- Server handlers stream directly, not through pubsub
- Would need to refactor to use pubsub for all streaming
- Affects multiple endpoints (workflow stream, watch, execute)
- Risk of breaking existing behavior

**Recommendation:** Keep current approach for now. The CachingPubSub pattern works well for agent streaming where pubsub is already used. Server workflow streaming uses direct Transform streams which is a different pattern.

**Future option:** Create a `CachingTransformStream` utility that provides similar functionality for direct streaming use cases.

---

### 3. Integration Tests

**Priority:** High - **COMPLETE**

**Tests completed:**

`packages/core/src/agent/durable/__tests__/resumable-streams.test.ts` (6 tests):
- [x] Late subscriber receives full history via replay
- [x] Receives both cached and live events
- [x] Multiple concurrent subscribers each get full history
- [x] Disconnect/reconnect scenario (unsubscribe, miss events, resubscribe with replay)
- [x] Topic isolation between runs
- [x] Cache cleanup

`packages/core/src/agent/durable/__tests__/create-durable-agent.test.ts` (12 tests):
- [x] Basic factory creation from regular Agent
- [x] ID/name override
- [x] Type guard (isLocalDurableAgent)
- [x] Default InMemoryServerCache
- [x] Custom cache support
- [x] CachingPubSub wrapping
- [x] Custom pubsub wrapped with CachingPubSub
- [x] Proxy behavior for agent access
- [x] getDurableWorkflows returns workflows
- [x] __setMastra accepts mastra instance

`packages/core/src/agent/durable/__tests__/cache-ttl.test.ts` (10 tests):
- [x] Configurable TTL on InMemoryServerCache
- [x] Cache item expiry after TTL
- [x] List item expiry after TTL
- [x] TTL refresh on list push
- [x] Disable TTL with ttlMs: 0
- [x] Respect maxSize option (LRU eviction)
- [x] Empty history when cache expires
- [x] Live events still work after cache expires
- [x] Partial cache expiry handling
- [x] Default TTL values

`stores/redis/src/integration.test.ts` (11 tests):
- [x] Set and get values with automatic JSON serialization
- [x] Return null for non-existent keys
- [x] Delete keys
- [x] Push and retrieve list items
- [x] Return list length
- [x] Return range of items
- [x] TTL expiry behavior with real Redis
- [x] CachingPubSub: replay events to late subscriber
- [x] CachingPubSub: receive both cached and live events
- [x] CachingPubSub: disconnect/reconnect scenario
- [x] CachingPubSub: topic isolation

**All integration tests complete!**

---

### 4. Resume API

**Priority:** Medium - **COMPLETE**

The `resume()` method is fully implemented with:
- [x] Workflow state restoration via run registry
- [x] Re-subscription with replay via CachingPubSub
- [x] Tool approval resume flow with callbacks
- [x] Context preservation (threadId, resourceId)

**Tests:** `packages/core/src/agent/durable/__tests__/resume-api.test.ts` (12 tests):
- [x] DurableAgent.resume() method available
- [x] Accept runId and resumeData
- [x] Preserve threadId/resourceId through prepare/resume
- [x] LocalDurableAgent has resume method
- [x] Return stream result from resume
- [x] Event replay with CachingPubSub
- [x] Event deduplication during replay
- [x] onSuspended callback support
- [x] onFinish callback support
- [x] onError callback support
- [x] Maintain run registry across prepare/resume
- [x] Registry cleanup on cleanup()

---

### 5. Cache TTL Configuration

**Priority:** Low - **PARTIALLY COMPLETE**

**Completed:**
- [x] Configurable TTL on InMemoryServerCache (`ttlMs` option)
- [x] Configurable TTL on RedisServerCache (`ttlSeconds` option)
- [x] Cache size limits / eviction policies (InMemoryServerCache `maxSize` option)

**Ideas (future):**
- [ ] Make cache TTL configurable per-agent at runtime
- [ ] Different TTLs for different event types
- [ ] Auto-cleanup of completed run caches

---

### 6. Observability

**Priority:** Low

**Ideas:**
- [ ] Emit metrics for cache hits/misses
- [ ] Log replay events for debugging
- [ ] Dashboard for active streams / cache usage

---

## Future Ideas

### Postgres Cache Backend
Create `PostgresServerCache` for deployments without Redis.

```typescript
import { PostgresServerCache } from '@mastra/pg';

const cache = new PostgresServerCache({
  connectionString: process.env.DATABASE_URL,
});
```

### Stream Checkpointing
Allow clients to specify a checkpoint (last event ID) when reconnecting instead of replaying full history.

```typescript
const { output } = await durableAgent.stream(messages, {
  resumeFromEventId: 'evt_abc123',
});
```

### Multi-Region Stream Replication
For globally distributed deployments, replicate stream events across regions.

### Client SDK Integration
Add resumable stream support to `@mastra/client-js`:

```typescript
const stream = await client.agents.stream('my-agent', messages, {
  resumable: true,
  onDisconnect: () => console.log('Disconnected, will auto-resume'),
});
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Client                                  │
│  (can disconnect/reconnect without missing events)          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   CachingPubSub                              │
│  ┌─────────────────────┐    ┌─────────────────────────┐     │
│  │    Inner PubSub     │    │   MastraServerCache     │     │
│  │  (EventEmitter,     │    │  (InMemory, Redis,      │     │
│  │   Inngest, etc)     │    │   Postgres, etc)        │     │
│  └─────────────────────┘    └─────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Durable Agent / Workflow Engine                 │
│  (LocalExecutor, Inngest, Evented)                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Reference

### Create a durable agent with resumable streams

```typescript
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { RedisServerCache } from '@mastra/redis';
import Redis from 'ioredis';

const agent = new Agent({
  id: 'my-agent',
  instructions: 'You are helpful',
  model: openai('gpt-4'),
});

// With Redis for distributed deployments
const cache = new RedisServerCache({
  client: new Redis(process.env.REDIS_URL)
});

const durableAgent = createDurableAgent({ agent, cache });

// Stream with resumable capability
const { output, runId, cleanup } = await durableAgent.stream('Hello!');
const text = await output.text;
cleanup();
```
