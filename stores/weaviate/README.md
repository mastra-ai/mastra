# @mastra/weaviate

A vector store implementation for Weaviate using the official [Weaviate client](https://www.npmjs.com/package/weaviate-client) with added dimension validation, collection management, and document storage capabilities.

## Installation

```bash
npm install @mastra/weaviate
```

## Usage

```typescript
import { WeaviateVector } from '@mastra/weaviate';

const weaviate = await WeaviateVector.use({
  httpHost: process.env.WEAVIATE_URL, // URL only, no http prefix
  httpPort: 443,
  grpcHost: process.env.WEAVIATE_GRPC_URL,
  grpcPort: 443, // Default is 50051, Weaviate Cloud uses 443
  grpcSecure: true,
  httpSecure: true,
  authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY),
});

// Create a new collection
await weaviate.createIndex({ indexName: 'myCollection', dimension });

// Add vectors with documents
const testVectors = [
  [1.0, 0.0, 0.0],
  [0.0, 1.0, 0.0],
  [0.0, 0.0, 1.0],
];

const testMetadata = [{ label: 'x' }, { label: 'y' }, { label: 'z' }];
let vectorIds: string[];

const vectorIds = await weaviate.upsert({
  indexName: testCollectionName,
  vectors: testVectors,
  metadata: testMetadata,
});

// Query vectors with document filtering
const queryVector = [0.0, 1.0, 0.0];
const filter = { label: 'y' };

const results = await weaviate.query({ indexName: testCollectionName, queryVector, topK: 1, filter });
```

## Configuration

For both the open source version and cloud versions of weaviate, you need to provide the following configuration:

- `httpHost`: URL of your Weaviate server
- `httpPort`: Port of your Weaviate server
- `grpcHost`: URL of your Weaviate server
- `grpcPort`: Port of your Weaviate server
- `grpcSecure`: Whether to use TLS for gRPC communication
- `httpSecure`: Whether to use TLS for HTTP communication

Some optional configuration options are available are:

- `authCredentials`: Authentication configuration
- `timeout`: Request timeout in seconds
- `headers`: Additional headers to include in requests
- `skipInitChecks`: Whether to skip initialization checks

## Features

- Vector similarity search with the cosine distance metric
- Document storage and retrieval
- Document content filtering
- Strict vector dimension validation
- Collection-based organization
- Metadata filtering support
- Optional vector inclusion in query results
- Automatic UUID generation for vectors
- Built-in collection caching for performance
- Built on top of [Weaviate client](https://www.npmjs.com/package/weaviate-client)

## Methods

- `createIndex({ indexName, dimension })`: Create a new collection
- `upsert({ indexName, vectors, metadata?, ids?, documents? })`: Add or update vectors with optional document storage
- `query({ indexName, queryVector, topK?, filter?, includeVector?, documentFilter? })`: Search for similar vectors with optional document filtering
- `listIndexes()`: List all collections
- `describeIndex(indexName)`: Get collection statistics
- `deleteIndex(indexName)`: Delete a collection

## Query Response Format

Query results include:

- `id`: Vector ID
- `score`: Distance/similarity score
- `metadata`: Associated metadata
- `document`: Original document text (if stored)
- `vector`: Original vector (if includeVector is true)

## Related Links

- [Weaviate Documentation](https://weaviate.io/developers/weaviate/client-libraries/typescript/typescript-v3)
- [Weaviate API Reference](https://weaviate.io/developers/weaviate/api/rest)
