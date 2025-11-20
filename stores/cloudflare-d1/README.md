# @mastra/cloudflare-d1

Cloudflare D1 SQL database storage implementation for Mastra.

## Installation

```bash
pnpm add @mastra/cloudflare-d1
```

## Prerequisites

- Cloudflare account with D1 enabled
- D1 database created and configured

## Quick Start

### With Workers D1 Binding

```typescript
import { D1Store } from '@mastra/cloudflare-d1';
import { Mastra } from '@mastra/core/mastra';

const storage = new D1Store({
  id: 'my-storage-id',
  binding: env.DB, // D1Database binding from Worker environment
});

const mastra = new Mastra({
  storage: storage,
});
```

### With REST API

```typescript
const storage = new D1Store({
  id: 'my-storage-id',
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
});
```

## Access Domain Stores

```typescript
const memoryStore = await storage.getStore('memory');
const workflowsStore = await storage.getStore('workflows');
const evalsStore = await storage.getStore('evals');
```

## Configuration

- `binding`: D1Database binding (Workers API)
- `accountId`: Cloudflare account ID (REST API)
- `databaseId`: D1 database ID (REST API)
- `apiToken`: Cloudflare API token (REST API)
- `tablePrefix`: Optional prefix for table names

## Documentation

For complete documentation, see:

- [Storage Overview](https://mastra.ai/docs/v1/server-db/storage) - Learn about storage domains and composite storage
- [Memory Domain Reference](https://mastra.ai/reference/v1/storage-domains/memory) - Threads, messages, and resources API
- [Workflows Domain Reference](https://mastra.ai/reference/v1/storage-domains/workflows) - Workflow snapshots and runs API
- [Evals Domain Reference](https://mastra.ai/reference/v1/storage-domains/evals) - Evaluation scores API

## Related Links

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
