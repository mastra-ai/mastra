# Durable Agent POC - Implementation Plan

## Overview

This branch implements durable execution patterns for Mastra agents with resumable streams. The goal is to allow agents to survive crashes and clients to reconnect without missing events.

**Key Concepts:**
- **Durable Execution** - Agentic loop runs on workflow engine, survives crashes
- **Resumable Streams** - Client can disconnect/reconnect without missing events

---

## Completed Work

All core functionality is implemented and tested:

| Feature | Status | Tests |
|---------|--------|-------|
| CachingPubSub & Resumable Streams | ✅ Complete | 6 tests |
| Redis Cache Infrastructure (`@mastra/redis`) | ✅ Complete | 20 unit + 11 integration |
| Evented/Inngest Agent Caching | ✅ Complete | - |
| Cache TTL Configuration | ✅ Complete | 10 tests |
| Resume API | ✅ Complete | 12 tests |
| createDurableAgent Factory | ✅ Complete | 12 tests |

**Total: 71 new tests for resumable streams functionality**

---

## Remaining Work

### 1. Server Workflow Handlers Migration

**Priority:** Low | **Status:** DEFERRED

The server uses direct streaming with manual cache calls (`listPush`) instead of PubSub. Migrating to CachingPubSub would require significant refactoring.

**Decision:** Keep current approach. CachingPubSub works for agent streaming (PubSub-based). Server workflow streaming uses Transform streams (different pattern).

**Future option:** Create `CachingTransformStream` utility for direct streaming use cases.

---

### 2. Per-Agent TTL Configuration

**Priority:** Low

Allow agents to specify custom TTL at runtime instead of using cache defaults.

```typescript
const durableAgent = createDurableAgent({
  agent,
  cache,
  cacheTtl: 60 * 10, // 10 minutes for this agent
});
```

---

### 3. Auto-Cleanup of Completed Runs

**Priority:** Low

Automatically clear cache entries when a run completes successfully, rather than waiting for TTL expiry.

```typescript
// On finish event, clear the run's cache entry
await cache.delete(`agent.stream.${runId}`);
```

---

### 4. Observability

**Priority:** Low

Ideas for debugging and monitoring:
- Emit metrics for cache hits/misses
- Log replay events for debugging
- Dashboard for active streams / cache usage

---

## Future Ideas

### Postgres Cache Backend

For deployments without Redis:

```typescript
import { PostgresServerCache } from '@mastra/pg';

const cache = new PostgresServerCache({
  connectionString: process.env.DATABASE_URL,
});
```

### Stream Checkpointing

Resume from a specific event instead of replaying full history:

```typescript
const { output } = await durableAgent.stream(messages, {
  resumeFromEventId: 'evt_abc123',
});
```

### Client SDK Integration

Add resumable stream support to `@mastra/client-js`:

```typescript
const stream = await client.agents.stream('my-agent', messages, {
  resumable: true,
  onDisconnect: () => console.log('Will auto-resume'),
});
```

---

## Architecture

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
