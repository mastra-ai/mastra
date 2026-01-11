# @mastra/redis

Redis storage provider for Mastra that provides storage capabilities for direct Redis connections.

## Installation

```bash
npm install @mastra/redis
```

## Usage

### Basic Usage

```typescript
import { RedisStore } from '@mastra/redis';

// Using connection string
const storage = new RedisStore({
  id: 'my-storage',
  connectionString: 'redis://localhost:6379',
});

// Using host/port config
const storage = new RedisStore({
  id: 'my-storage',
  host: 'localhost',
  port: 6379,
  password: 'your-password',
  db: 0,
});

// Initialize (connects to Redis)
await storage.init();
```

### With Pre-configured Client

```typescript
import { RedisStore } from '@mastra/redis';
import { createClient } from 'redis';

// Create a custom redis client with specific settings
const client = createClient({
  url: 'redis://localhost:6379',
  socket: {
    reconnectStrategy: retries => Math.min(retries * 50, 2000),
  },
});

// Connect the client before passing to RedisStore
await client.connect();

const storage = new RedisStore({
  id: 'my-storage',
  client,
});
```

## Parameters

| Parameter          | Type          | Description                                            |
| ------------------ | ------------- | ------------------------------------------------------ |
| `id`               | `string`      | Unique identifier for the storage instance             |
| `connectionString` | `string`      | Redis connection URL (e.g., `redis://localhost:6379`)  |
| `host`             | `string`      | Redis host address                                     |
| `port`             | `number`      | Redis port (default: 6379)                             |
| `password`         | `string`      | Redis password for authentication                      |
| `db`               | `number`      | Redis database number (default: 0)                     |
| `client`           | `RedisClient` | Pre-configured redis client (from the `redis` package) |
| `disableInit`      | `boolean`     | Disable automatic initialization                       |

## Accessing Storage Domains

```typescript
// Access memory domain (threads, messages, resources)
const memory = await storage.getStore('memory');
await memory?.saveThread({ thread });
await memory?.saveMessages({ messages });

// Access workflows domain
const workflows = await storage.getStore('workflows');
await workflows?.persistWorkflowSnapshot({ workflowName, runId, snapshot });

// Access scores domain
const scores = await storage.getStore('scores');
await scores?.saveScore(score);
```

## Usage with Mastra Agent

```typescript
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { RedisStore } from '@mastra/redis';

export const redisAgent = new Agent({
  id: 'redis-agent',
  name: 'Redis Agent',
  instructions: 'You are an AI agent with memory backed by Redis.',
  model: 'openai/gpt-4',
  memory: new Memory({
    storage: new RedisStore({
      id: 'redis-agent-storage',
      connectionString: process.env.REDIS_URL!,
    }),
    options: {
      generateTitle: true,
    },
  }),
});
```

## Accessing the Underlying Client

You can access the underlying redis client for advanced operations:

```typescript
const storage = new RedisStore({
  id: 'my-storage',
  connectionString: 'redis://localhost:6379',
});

await storage.init();

// Get the redis client
const client = storage.getClient();

// Use for custom operations
await client.set('custom-key', 'value');
const value = await client.get('custom-key');
```

## Key Structure

The Redis storage uses the following key patterns:

- Threads: `mastra_threads:id:{threadId}`
- Messages: `mastra_messages:threadId:{threadId}:id:{messageId}`
- Message index: `msg-idx:{messageId}` (for fast lookups)
- Thread messages sorted set: `thread:{threadId}:messages`
- Workflow snapshots: `mastra_workflow_snapshot:namespace:{ns}:workflow_name:{name}:run_id:{id}`
- Scores: `mastra_scorers:id:{scoreId}`
- Resources: `mastra_resources:{resourceId}`

## Features

- Direct Redis connections via the official `redis` package (node-redis)
- Support for Redis Sentinel and Cluster (via custom client)
- Persistent storage for threads, messages, and resources
- Workflow state persistence with snapshot support
- Evaluation scores storage
- Sorted sets for message ordering
- Efficient batch operations with multi/exec

## Connection Options

### Standalone Redis

```typescript
const storage = new RedisStore({
  id: 'standalone',
  host: 'localhost',
  port: 6379,
});
```

### Redis with Password

```typescript
const storage = new RedisStore({
  id: 'auth',
  connectionString: 'redis://:password@localhost:6379',
});
```

### Redis Sentinel (via custom client)

```typescript
import { createClient } from 'redis';

const client = createClient({
  url: 'redis://localhost:26379',
  // Configure sentinel options as needed
});
await client.connect();

const storage = new RedisStore({
  id: 'sentinel',
  client,
});
```

### Redis Cluster (via custom client)

```typescript
import { createCluster } from 'redis';

const cluster = createCluster({
  rootNodes: [{ url: 'redis://node-1:6379' }, { url: 'redis://node-2:6379' }],
});
await cluster.connect();

// Note: Cluster support may require additional configuration
```

## Closing Connections

Always close connections when done:

```typescript
await storage.close();
```

## Related Links

- [Redis Documentation](https://redis.io/documentation)
- [node-redis Documentation](https://github.com/redis/node-redis)
- [Mastra Documentation](https://mastra.ai/docs)
