# @mastra/valkey

Valkey storage provider for Mastra that provides storage capabilities for direct Valkey connections.

## Installation

```bash
npm install @mastra/valkey
```

## Usage

### Basic Usage

```typescript
import { ValkeyStore } from '@mastra/valkey';

// Using connection string
const storage = new ValkeyStore({
  id: 'my-storage',
  connectionString: 'valkey://localhost:6379',
});

// Using host/port config
const storage = new ValkeyStore({
  id: 'my-storage',
  host: 'localhost',
  port: 6379,
  password: 'your-password',
  db: 0,
});

// Initialize (connects to Valkey)
await storage.init();
```

### With Pre-configured Client

```typescript
import { ValkeyStore } from '@mastra/valkey';
import { createClient } from 'valkey';

// Create a custom valkey client with specific settings
const client = createClient({
  url: 'valkey://localhost:6379',
  socket: {
    reconnectStrategy: retries => Math.min(retries * 50, 2000),
  },
});

// Connect the client before passing to ValkeyStore
await client.connect();

const storage = new ValkeyStore({
  id: 'my-storage',
  client,
});
```

## Parameters

| Parameter          | Type           | Description                                              |
| ------------------ | -------------- | -------------------------------------------------------- |
| `id`               | `string`       | Unique identifier for the storage instance               |
| `connectionString` | `string`       | Valkey connection URL (e.g., `valkey://localhost:6379`)  |
| `host`             | `string`       | Valkey host address                                      |
| `port`             | `number`       | Valkey port (default: 6379)                              |
| `password`         | `string`       | Valkey password for authentication                       |
| `db`               | `number`       | Valkey database number (default: 0)                      |
| `client`           | `ValkeyClient` | Pre-configured valkey client (from the `valkey` package) |
| `disableInit`      | `boolean`      | Disable automatic initialization                         |

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
import { ValkeyStore } from '@mastra/valkey';

export const valkeyAgent = new Agent({
  id: 'valkey-agent',
  name: 'Valkey Agent',
  instructions: 'You are an AI agent with memory backed by Valkey.',
  model: 'openai/gpt-4',
  memory: new Memory({
    storage: new ValkeyStore({
      id: 'valkey-agent-storage',
      connectionString: process.env.VALKEY_URL!,
    }),
    options: {
      generateTitle: true,
    },
  }),
});
```

## Accessing the Underlying Client

You can access the underlying valkey client for advanced operations:

```typescript
const storage = new ValkeyStore({
  id: 'my-storage',
  connectionString: 'valkey://localhost:6379',
});

await storage.init();

// Get the valkey client
const client = storage.getClient();

// Use for custom operations
await client.set('custom-key', 'value');
const value = await client.get('custom-key');
```

## Key Structure

The Valkey storage uses the following key patterns:

- Threads: `mastra_threads:id:{threadId}`
- Messages: `mastra_messages:threadId:{threadId}:id:{messageId}`
- Message index: `msg-idx:{messageId}` (for fast lookups)
- Thread messages sorted set: `thread:{threadId}:messages`
- Workflow snapshots: `mastra_workflow_snapshot:namespace:{ns}:workflow_name:{name}:run_id:{id}`
- Scores: `mastra_scorers:id:{scoreId}`
- Resources: `mastra_resources:{resourceId}`

## Features

- Direct Valkey connections via the official `valkey` package (node-valkey)
- Support for Valkey Sentinel and Cluster (via custom client)
- Persistent storage for threads, messages, and resources
- Workflow state persistence with snapshot support
- Evaluation scores storage
- Sorted sets for message ordering
- Efficient batch operations with multi/exec

## Connection Options

### Standalone Valkey

```typescript
const storage = new ValkeyStore({
  id: 'standalone',
  host: 'localhost',
  port: 6379,
});
```

### Valkey with Password

```typescript
const storage = new ValkeyStore({
  id: 'auth',
  connectionString: 'valkey://:password@localhost:6379',
});
```

### Valkey Sentinel (via custom client)

```typescript
import { createClient } from 'valkey';

const client = createClient({
  url: 'valkey://localhost:26379',
  // Configure sentinel options as needed
});
await client.connect();

const storage = new ValkeyStore({
  id: 'sentinel',
  client,
});
```

### Valkey Cluster (via custom client)

```typescript
import { ValkeyStore } from '@mastra/valkey';
import { createCluster } from 'valkey';

const cluster = createCluster({
  rootNodes: [{ url: 'valkey://node-1:6379' }, { url: 'valkey://node-2:6379' }],
});
await cluster.connect();

const storage = new ValkeyStore({
  id: 'cluster',
  client: cluster,
});
```

## Closing Connections

Always close connections when done:

```typescript
await storage.close();
```

## Related Links

- [Valkey Documentation](https://valkey.io/documentation)
- [node-valkey Documentation](https://github.com/valkey/node-valkey)
- [Mastra Documentation](https://mastra.ai/docs)
