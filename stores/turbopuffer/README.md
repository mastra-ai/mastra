# @mastra/turbopuffer

Vector store implementation for Turbopuffer, using the official @turbopuffer/turbopuffer SDK with added telemetry support.

## Installation

```bash
pnpm add @mastra/turbopuffer
```

## Usage

```typescript
import { TurbopufferVector } from '@mastra/turbopuffer';

const vectorStore = new TurbopufferVector({
  apiKey: 'your-api-key',
  baseUrl: 'https://gcp-us-central1.turbopuffer.com',
});

// Create a new index
await vectorStore.createIndex({ indexName: 'my-index', dimension: 1536, metric: 'cosine' });

// Add vectors
const vectors = [[0.1, 0.2, ...], [0.3, 0.4, ...]];
const metadata = [{ text: 'doc1' }, { text: 'doc2' }];
const ids = await vectorStore.upsert({ indexName: 'my-index', vectors, metadata });

// Query vectors
const results = await vectorStore.query({
  indexName: 'my-index',
  queryVector: [0.1, 0.2, ...],
  topK: 10,
  filter: { text: { $eq: 'doc1' } },
  includeVector: false,
);
```

## Configuration

Required:

- `apiKey`: Your Turbopuffer API key

Optional:

- `baseUrl`: Your Turbopuffer base URL (default: https://api.turbopuffer.com)
- `connectTimeout`: Timeout to establish a connection, in ms (default: 10_000)
- `connectionIdleTimeout`: Socket idle timeout, in ms (default: 60_000)
- `warmConnections`: Number of connections to open initially (default: 0)
- `compression`: Whether to compress requests and accept compressed responses (default: true)
- `schemaConfigForIndex`: A function that returns a Turbopuffer schema config for an index (default: undefined).

## Related Links

- [Turbopuffer Documentation](https://turbopuffer.com/docs)
- [Turbopuffer TypeScript Client Library](https://github.com/turbopuffer/turbopuffer-typescript)
