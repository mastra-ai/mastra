# @mastra/dynamodb

Persist Mastra data in Amazon DynamoDB with a single-table ElectroDB design, configurable indexes, TTL support, credentials, and table initialization.

## Installation

```bash
npm install @mastra/dynamodb
```

## Usage

### Basic Usage

```typescript
import { Memory } from '@mastra/memory';
import { DynamoDBStore } from '@mastra/dynamodb';
import { PineconeVector } from '@mastra/pinecone';

// Initialize the DynamoDB storage
const storage = new DynamoDBStore({
  name: 'dynamodb',
  config: {
    region: 'us-east-1',
    tableName: 'mastra-single-table', // Name of your DynamoDB table
  },
});

// Initialize vector store (if using semantic recall)
const vector = new PineconeVector({
  id: 'dynamodb-pinecone',
  apiKey: process.env.PINECONE_API_KEY,
});

// Memory combines storage (like DynamoDBStore) with an optional vector store for recall
// Create memory with DynamoDB storage
const memory = new Memory({
  storage,
  vector,
  options: {
    lastMessages: 10,
    semanticRecall: true,
  },
});
```

## Documentation

- [DynamoDB](https://mastra.ai/integrations/databases/dynamodb)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/dynamodb/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
