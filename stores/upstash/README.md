# @mastra/upstash

Upstash provider for Mastra that includes both vector store and database storage capabilities.

## Installation

```bash
npm install @mastra/upstash
```

## Vector Store Usage

```typescript
import { UpstashVector } from '@mastra/upstash';

const vectorStore = new UpstashVector({
  // configuration options
});
```

### Vector Store Configuration

The Upstash vector store requires the following configuration:

- `UPSTASH_VECTOR_REST_URL`: Your Upstash Vector REST URL
- `UPSTASH_VECTOR_TOKEN`: Your Upstash Vector REST token
- `UPSTASH_INDEX`: Name of the index to use

## Database Storage Usage

```typescript
import { UpstashStore } from '@mastra/upstash';

const store = new UpstashStore({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
```

### Database Storage Configuration

The Upstash store requires the following configuration:

- `UPSTASH_REDIS_REST_URL`: Your Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN`: Your Upstash Redis REST token

## Features

- Serverless vector database and key-value store
- Pay-per-use pricing
- Low latency global access
- REST API interface
- Built-in vector similarity search
- Durable storage for chat history and agent memory

## Related Links

- [Upstash Vector Documentation](https://docs.upstash.com/vector)
- [Upstash Redis Documentation](https://docs.upstash.com/redis)
