# @mastra/vector-upstash

Vector store implementation for Upstash Vector, a fully managed vector database service.

## Installation

```bash
npm install @mastra/vector-upstash
```

## Usage

```typescript
import { UpstashVectorStore } from '@mastra/vector-upstash';

const vectorStore = new UpstashVectorStore({
  // configuration options
});
```

## Configuration

The Upstash vector store requires the following configuration:

- `UPSTASH_VECTOR_REST_URL`: Your Upstash Vector REST URL
- `UPSTASH_VECTOR_TOKEN`: Your Upstash Vector REST token
- `UPSTASH_INDEX`: Name of the index to use

## Features

- Serverless vector database
- Pay-per-use pricing
- Low latency global access
- REST API interface
- Built-in vector similarity search

## Related Links

- [Upstash Vector Documentation](https://docs.upstash.com/vector)
