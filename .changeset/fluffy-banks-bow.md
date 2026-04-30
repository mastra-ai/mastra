---
'@mastra/core': minor
'@mastra/inngest': minor
'@mastra/server': patch
'@mastra/client-js': patch
'@mastra/redis': patch
'@mastra/upstash': patch
'@mastra/observability': patch
---

Add durable agents with resumable streams

Durable agents make agent execution resilient to disconnections, crashes, and long-running operations.

### The Problem

Standard agent streaming has two fragility points:

1. **Connection drops** - If a client disconnects mid-stream (network blip, browser refresh, mobile app backgrounded), all subsequent events are lost. The client has no way to "catch up" on what they missed.

2. **Long-running operations** - Agent loops with tool calls can take minutes. Holding an HTTP connection open that long is unreliable. If the server restarts or the connection times out, the work is lost.

### The Solution

**Resumable streams** solve connection drops. Every event is cached with a sequential index. If a client disconnects at event 5, they can reconnect and request events starting from index 6. They receive cached events immediately, then continue with live events as they arrive.

**Durable execution** solves long-running operations. Instead of executing the agent loop directly in the HTTP request, execution happens in a workflow engine (built-in evented engine or Inngest). The HTTP request just subscribes to events. If the connection drops, execution continues. The client can reconnect anytime to observe progress.

### Usage

Wrap any existing `Agent` with durability using factory functions:

```typescript
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';

const agent = new Agent({
  id: 'my-agent',
  model: openai('gpt-4'),
  instructions: 'You are helpful',
});

const durableAgent = createDurableAgent({ agent });
```

**Factory functions for different execution strategies:**

| Factory | Execution | Use Case |
|---------|-----------|----------|
| `createDurableAgent({ agent })` | Local, synchronous | Development, simple deployments |
| `createEventedAgent({ agent })` | Fire-and-forget via workflow engine | Long-running operations |
| `createInngestAgent({ agent, inngest })` | Inngest-powered | Production, distributed systems |

### Resumable Streams

```typescript
// Start streaming
const { runId, output } = await durableAgent.stream('Analyze this data...');

// Client disconnects at event 5...

// Reconnect and resume from where we left off
const { output: resumed } = await durableAgent.observe(runId, { offset: 6 });
// Receives events 6, 7, 8... from cache, then continues with live events
```

### PubSub and Cache

Durable agents use two infrastructure components:

| Component | Purpose | Default |
|-----------|---------|---------|
| **PubSub** | Real-time event delivery during streaming | `EventEmitterPubSub` |
| **Cache** | Stores events for replay on reconnection | `InMemoryServerCache` |

When `stream()` is called, events flow through pubsub in real-time. The cache stores each event with a sequential index. When `observe()` is called, missed events replay from cache before continuing with live events.

**Configure via Mastra instance (recommended):**

```typescript
const mastra = new Mastra({
  cache: new RedisServerCache({ url: 'redis://...' }),
  pubsub: new RedisPubSub({ url: 'redis://...' }),
  agents: {
    // Inherits cache and pubsub from Mastra
    myAgent: createDurableAgent({ agent }),
  },
});
```

**Configure per-agent (overrides Mastra):**

```typescript
const durableAgent = createDurableAgent({
  agent,
  cache: new RedisServerCache({ url: 'redis://...' }),
  pubsub: new RedisPubSub({ url: 'redis://...' }),
});
```

**Disable caching (streams won't be resumable):**

```typescript
const durableAgent = createDurableAgent({ agent, cache: false });
```

For single-instance deployments, the defaults work fine. For multi-instance deployments (load balancer, horizontal scaling), use Redis-backed implementations so any instance can serve reconnection requests.

### Class Hierarchy

- `DurableAgent` extends `Agent` - base class with resumable streams
- `EventedAgent` extends `DurableAgent` - fire-and-forget execution
- `InngestAgent` extends `DurableAgent` - Inngest-powered execution
