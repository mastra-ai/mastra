# @mastra/dynamodb

DynamoDB storage implementation for Mastra using a single-table design pattern.

## Installation

```bash
npm install @mastra/dynamodb
```

## Prerequisites

- AWS DynamoDB table (see [TABLE_SETUP.md](./TABLE_SETUP.md) for setup instructions)
- AWS credentials configured

## Quick Start

```typescript
import { DynamoDBStore } from '@mastra/dynamodb';
import { Mastra } from '@mastra/core/mastra';

// Initialize DynamoDBStore
const storage = new DynamoDBStore({
  name: 'dynamodb-storage',
  config: {
    id: 'my-storage-id',
    region: 'us-east-1',
    tableName: 'mastra-single-table',
    // Optional: endpoint for DynamoDB Local
    // endpoint: 'http://localhost:8000',
  },
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

- `region`: AWS region (default: `us-east-1`)
- `tableName`: DynamoDB table name (required)
- `endpoint`: Optional endpoint for DynamoDB Local
- `credentials`: Optional AWS credentials (uses default credential chain if not provided)

## Documentation

For complete documentation, see:

- [Storage Overview](https://mastra.ai/docs/v1/server-db/storage) - Learn about storage domains and composite storage
- [Memory Domain Reference](https://mastra.ai/reference/v1/storage-domains/memory) - Threads, messages, and resources API
- [Workflows Domain Reference](https://mastra.ai/reference/v1/storage-domains/workflows) - Workflow snapshots and runs API
- [Evals Domain Reference](https://mastra.ai/reference/v1/storage-domains/evals) - Evaluation scores API

## Related Links

- [TABLE_SETUP.md](./TABLE_SETUP.md) - DynamoDB table setup guide
- [AWS DynamoDB Documentation](https://docs.aws.amazon.com/dynamodb/)
