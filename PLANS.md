# Future Plans

## Durable Scorer Execution on Inngest

**Status:** Planned

**Problem:** Scorers currently run fire-and-forget via `executeHook()` with `setImmediate()`. This means:
- No durability - if the process crashes, scorer execution is lost
- No visibility - can't see scorer status in Inngest dashboard
- No retries - scorer failures are silent

**Proposed Solution:** Run scorers as a **separate Inngest workflow** triggered fire-and-forget style.

### Architecture

```
Current (fire-and-forget, no durability):
  Agent workflow completes → runScorer() → setImmediate() → scorer.run()
                                            ↑
                                            Lost if process crashes

Proposed (fire-and-forget trigger, durable execution):
  Agent workflow completes → step.sendEvent('scorer.run.requested', payload)
                                            ↓
                            Separate Inngest function picks up event
                                            ↓
                            Runs scorer.run() durably with retries
                                            ↓
                            Saves to storage, exports to observability
```

### Benefits
- Main agent workflow stays fast (not blocked by scorers)
- Scorers run durably on Inngest (survives crashes, has retries)
- Full visibility in Inngest dashboard
- Decoupled - can scale scorer execution independently

### Implementation Notes
1. Create a separate Inngest function that listens for `scorer.run.requested` events
2. At end of agent workflow, use `step.sendEvent()` to trigger scorer execution
3. The scorer function resolves the scorer from Mastra and runs it
4. Results saved to storage and exported to observability as usual

### Files to Modify
- `/workflows/inngest/src/durable-agent/create-inngest-agentic-workflow.ts` - Add event emission at end
- `/workflows/inngest/src/` - New scorer execution function
- `/packages/core/src/mastra/hooks.ts` - Extract scorer execution logic for reuse

---

## Resumable Streams via CachingPubSub

**Status:** Partially Complete

**Concept:** Durable execution and resumable streams are separate concerns:
- **Durable Execution** - Agentic loop survives crashes (workflow engine)
- **Resumable Streams** - Client can disconnect/reconnect without missing events (caching)

### Completed

- [x] Extended `PubSub` interface with `getHistory()` and `subscribeWithReplay()` methods
- [x] Created `CachingPubSub` decorator (`packages/core/src/events/caching-pubsub.ts`)
- [x] Exported from events module
- [x] Created `createDurableAgent()` factory function (`packages/core/src/agent/durable/create-durable-agent.ts`)
- [x] Updated `DurableAgent` to use `CachingPubSub` by default
- [x] Updated stream adapter to use `subscribeWithReplay()`
- [x] Created `@mastra/redis` package - generic `RedisServerCache` works with any Redis client
- [x] Updated `@mastra/upstash` to use `@mastra/redis` with upstash preset
- [x] Unit tests for `CachingPubSub` (22 tests)
- [x] Unit tests for `RedisServerCache` (19 tests)
- [x] Unit tests for `UpstashServerCache` (12 tests)

### Remaining

- [ ] **Server workflow handlers migration** - Remove manual cache calls in `packages/server/src/server/handlers/workflows.ts`, use PubSub caching instead (lines 384, 442, 588, 1037, 1136, 1195)
- [ ] **Wire caching into `createEventedAgent`** - Ensure evented agent uses CachingPubSub
- [ ] **Wire caching into `createInngestAgent`** - Ensure Inngest agent uses CachingPubSub
- [ ] **Integration tests** - DurableAgent disconnect/reconnect scenario, workflow observe with late subscriber
- [ ] **End-to-end testing** - Manual verification with actual Redis backend
- [ ] **Documentation** - Update docs with resumable streams usage examples

### Usage

```typescript
// Local durable agent with in-memory cache (default)
import { createDurableAgent } from '@mastra/core/agent/durable';
const durableAgent = createDurableAgent({ agent });

// With Redis cache for distributed deployments
import { RedisServerCache } from '@mastra/redis';
import Redis from 'ioredis';

const cache = new RedisServerCache({ client: new Redis() });
const durableAgent = createDurableAgent({ agent, cache });

// With Upstash (convenience wrapper)
import { UpstashServerCache } from '@mastra/upstash';
const cache = new UpstashServerCache({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
const durableAgent = createDurableAgent({ agent, cache });
```

### Files Modified/Created

| File | Status |
|------|--------|
| `packages/core/src/events/pubsub.ts` | Modified - added interface methods |
| `packages/core/src/events/caching-pubsub.ts` | Created |
| `packages/core/src/events/index.ts` | Modified - exports |
| `packages/core/src/agent/durable/create-durable-agent.ts` | Created |
| `packages/core/src/agent/durable/durable-agent.ts` | Modified - uses CachingPubSub |
| `packages/core/src/agent/durable/stream-adapter.ts` | Modified - uses subscribeWithReplay |
| `packages/core/src/agent/durable/index.ts` | Modified - exports |
| `stores/redis/` | Created - new package |
| `stores/upstash/src/cache/` | Modified - uses @mastra/redis |
