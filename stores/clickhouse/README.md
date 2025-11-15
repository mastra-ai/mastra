# @mastra/clickhouse

ClickHouse storage implementation for Mastra.

## Installation

```bash
npm install @mastra/clickhouse
```

## Prerequisites

- ClickHouse server 21.8 or higher

## Quick Start

```typescript
import { ClickhouseStore } from '@mastra/clickhouse';
import { Mastra } from '@mastra/core/mastra';

// Initialize ClickhouseStore
const storage = new ClickhouseStore({
  id: 'my-storage-id',
  url: 'http://localhost:8123',
  username: 'default',
  password: 'password',
});

// Configure Mastra
const mastra = new Mastra({
  storage: storage,
});

// Access domain stores
const memoryStore = await storage.getStore('memory');
const workflowsStore = await storage.getStore('workflows');
const evalsStore = await storage.getStore('evals');
```

## Configuration

- `url`: ClickHouse server URL
- `username`: Database username
- `password`: Database password
- `ttl`: Optional TTL configuration for automatic data expiration

## Documentation

For complete documentation, see:

- [Storage Overview](https://mastra.ai/docs/v1/server-db/storage) - Learn about storage domains and composite storage
- [Memory Domain Reference](https://mastra.ai/reference/v1/storage-domains/memory) - Threads, messages, and resources API
- [Workflows Domain Reference](https://mastra.ai/reference/v1/storage-domains/workflows) - Workflow snapshots and runs API
- [Evals Domain Reference](https://mastra.ai/reference/v1/storage-domains/evals) - Evaluation scores API

## Related Links

- [ClickHouse Documentation](https://clickhouse.com/docs)
