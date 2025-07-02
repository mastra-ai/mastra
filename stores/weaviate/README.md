# @mastra/weaviate

A vector store implementation for Weaviate using the official [weaviate client](https://www.npmjs.com/package/weaviate-client) with comprehensive vector operations, advanced filtering, and multiple distance metrics.

## Installation

```bash
npm install @mastra/weaviate
```

## Usage

```typescript
import { WeaviateVector } from '@mastra/weaviate';

// Local development (default connection)
const weaviate = await WeaviateVector.use();

// Production with custom configuration
const weaviate = await WeaviateVector.use({
  httpHost: process.env.WEAVIATE_URL, // URL only, no http prefix
  httpPort: 443,
  grpcHost: process.env.WEAVIATE_GRPC_URL,
  grpcPort: 443, // Default is 50051, Weaviate Cloud uses 443
  grpcSecure: true,
  httpSecure: true,
  authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY),
});

// Create a new collection with distance metric
await weaviate.createIndex({
  indexName: 'myCollection',
  metric: 'cosine', // 'cosine', 'euclidean', or 'dotproduct'
});

// Add vectors with metadata
const vectors = [
  [1.0, 0.0, 0.0],
  [0.0, 1.0, 0.0],
  [0.0, 0.0, 1.0],
];

const metadata = [
  { label: 'x', category: 'axis' },
  { label: 'y', category: 'axis' },
  { label: 'z', category: 'axis' },
];

const vectorIds = await weaviate.upsert({
  indexName: 'myCollection',
  vectors,
  metadata,
});

// Query vectors with advanced filtering
const results = await weaviate.query({
  indexName: 'myCollection',
  queryVector: [0.0, 1.0, 0.0],
  topK: 5,
  filter: {
    $and: [{ category: 'axis' }, { label: { $in: ['x', 'y'] } }],
  },
  includeVector: true,
});
```

## Configuration

### Connection Parameters

- `httpHost`: HTTP host for Weaviate connection
- `httpPort`: HTTP port for Weaviate connection
- `httpSecure`: Whether to use HTTPS for HTTP connections
- `grpcHost`: gRPC host for Weaviate connection
- `grpcPort`: gRPC port for Weaviate connection
- `grpcSecure`: Whether to use secure gRPC connections

### Optional Parameters

- `authCredentials`: Authentication credentials (API key, OAuth, etc.)
- `timeout`: Connection timeout in milliseconds
- `headers`: Additional HTTP headers
- `skipInitChecks`: Whether to skip initialization checks

## Features

- **Multiple Distance Metrics**: Cosine, Euclidean, and Dot Product similarity
- **Advanced Filtering**: Complex queries with logical operators ($and, $or)
- **Batch Processing**: Automatic batching of 500 vectors for optimal performance
- **Comprehensive Operators**: Support for $eq, $ne, $gt, $gte, $lt, $lte, $in, $all, $length, $geo, $null, $regex
- **Vector Operations**: Full CRUD operations for vectors and metadata
- **Index Management**: Create, list, describe, and delete collections
- **Performance Optimized**: Built-in caching and concurrent operations
- **Type Safety**: Full TypeScript support with strong typing

## Core Methods

### Index Management

- `createIndex({ indexName, metric })`: Create a new collection with specified distance metric
- `listIndexes()`: List all available collections
- `describeIndex({ indexName })`: Get collection statistics (dimension, count, metric)
- `deleteIndex({ indexName })`: Delete a collection

### Vector Operations

- `upsert({ indexName, vectors, metadata?, ids? })`: Add or update vectors with metadata
- `query({ indexName, queryVector, topK?, filter?, includeVector? })`: Search for similar vectors
- `updateVector({ indexName, id, update })`: Update specific vector and/or metadata
- `deleteVector({ indexName, id })`: Delete specific vector by ID

## Advanced Filtering Examples

### Basic Operators

```typescript
// Comparison operators
const filter = {
  price: { $gt: 100, $lt: 500 },
  category: { $eq: 'electronics' },
  rating: { $gte: 4.0 },
};
```

### Logical Operators

```typescript
// Complex logical filtering
const filter = {
  $and: [
    { category: { $in: ['tech', 'science'] } },
    { $or: [{ price: { $lt: 100 } }, { featured: true }] },
    { tags: { $all: ['popular', 'trending'] } },
  ],
};
```

### Special Operators

```typescript
// Array length filtering
const lengthFilter = { tags: { $length: { $gte: 3 } } };

// Geo-radius filtering
const geoFilter = {
  location: {
    $geo: {
      lat: 37.7749,
      lon: -122.4194,
      radius: 10000, // meters
    },
  },
};

// Regex pattern matching
const regexFilter = { title: { $regex: '^Product.*' } };
```

## Distance Metrics

- **cosine** (default): Best for normalized vectors and semantic similarity
- **euclidean**: Best for absolute distance measurements
- **dotproduct**: Best for sparse vectors and when vector magnitude matters

## Performance Considerations

- Vectors are automatically batched in groups of 500 for upsert operations
- Concurrent operations are supported for better throughput
- Use appropriate filters to reduce search space
- Monitor collection statistics for performance optimization

## Related Links

- [Weaviate Documentation](https://weaviate.io/developers/weaviate/client-libraries/typescript/typescript-v3)
- [Weaviate API Reference](https://weaviate.io/developers/weaviate/api/rest)
- [Mastra Core Documentation](https://docs.mastra.ai)
