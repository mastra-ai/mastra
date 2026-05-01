# Durable Agents Example

This example demonstrates three patterns for durable agent execution, all with Redis-backed resumable streams.

## Agent Patterns

| Agent                  | Factory              | Resumable Streams | Durable Execution |
| ---------------------- | -------------------- | ----------------- | ----------------- |
| `durableResearchAgent` | `createDurableAgent` | Redis             | -                 |
| `eventedResearchAgent` | `createEventedAgent` | Redis             | Workflow engine   |
| `inngestResearchAgent` | `createInngestAgent` | Redis             | Inngest           |

## Setup

1. Start Redis:

```bash
docker run -d -p 6379:6379 redis
```

2. Install dependencies:

```bash
pnpm install
```

3. Start the dev server:

```bash
pnpm dev
```

4. For Inngest agent, start the Inngest dev server:

```bash
npx inngest-cli@latest dev
```

## Usage

### Start a stream

```bash
curl -X POST http://localhost:4111/api/agents/durable-research-agent/stream \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Research quantum computing"}]}'
```

### Reconnect to a stream

If your connection drops, use the `runId` to reconnect:

```bash
curl -X POST http://localhost:4111/api/agents/durable-research-agent/observe \
  -H "Content-Type: application/json" \
  -d '{"runId": "your-run-id", "offset": 5}'
```

## How It Works

All three agent types inherit `cache` and `pubsub` from the Mastra instance:

```typescript
import { EventEmitterPubSub } from '@mastra/core/events';
import { RedisServerCache } from '@mastra/redis';

// Redis cache for resumable streams - events persist across reconnections
const cache = new RedisServerCache({ url: 'redis://localhost:6379' });

// EventEmitter pubsub for real-time delivery (process-local)
const pubsub = new EventEmitterPubSub();

export const mastra = new Mastra({
  cache,
  pubsub,
  agents: {
    durableResearchAgent, // Inherits cache/pubsub
    eventedResearchAgent, // Inherits cache/pubsub
    inngestResearchAgent, // Inherits cache/pubsub
  },
});
```

Events are cached with sequential indices. When `observe()` is called, missed events replay from cache before continuing with live events.
