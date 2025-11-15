# @mastra/cloudflare

Cloudflare KV storage implementation for Mastra.

## Installation

```bash
npm install @mastra/cloudflare
```

## Prerequisites

- Cloudflare account with KV namespaces configured
- Node.js 16+ or Cloudflare Worker

## Quick Start

### With Workers Binding API

```typescript
import { CloudflareStore } from '@mastra/cloudflare';
import { Mastra } from '@mastra/core/mastra';

const storage = new CloudflareStore({
  id: 'my-storage-id',
  bindings: {
    threads: THREADS_KV_NAMESPACE,
    messages: MESSAGES_KV_NAMESPACE,
    workflow_snapshot: WORKFLOW_KV_NAMESPACE,
    traces: TRACES_KV_NAMESPACE,
  },
});

const mastra = new Mastra({
  storage: storage,
});
```

### With REST API

```typescript
const storage = new CloudflareStore({
  id: 'my-storage-id',
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
});
```

## Access Domain Stores

```typescript
const memoryStore = await storage.getStore('memory');
const workflowsStore = await storage.getStore('workflows');
const evalsStore = await storage.getStore('evals');
```

## Documentation

For complete documentation, see:

- [Storage Overview](https://mastra.ai/docs/v1/server-db/storage) - Learn about storage domains and composite storage
- [Memory Domain Reference](https://mastra.ai/reference/v1/storage-domains/memory) - Threads, messages, and resources API
- [Workflows Domain Reference](https://mastra.ai/reference/v1/storage-domains/workflows) - Workflow snapshots and runs API
- [Evals Domain Reference](https://mastra.ai/reference/v1/storage-domains/evals) - Evaluation scores API

## Related Links

- [Cloudflare KV Documentation](https://developers.cloudflare.com/kv/)
