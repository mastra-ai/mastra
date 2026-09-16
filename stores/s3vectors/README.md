# @mastra/s3vectors

> ⚠️ Amazon S3 Vectors is a Preview service.
> Preview features may change or be removed without notice and are not covered by AWS SLAs.
> Behavior, limits, and regional availability can change at any time.
> This library may introduce breaking changes to stay aligned with AWS.

Vector store implementation for **Amazon S3 Vectors** (Preview) tailored for Mastra. It stores vectors in **vector buckets** and performs similarity queries in **vector indexes** with sub-second performance.

## Installation

```bash
npm install @mastra/s3vectors
```

## Usage

```typescript
import { S3Vectors } from '@mastra/s3vectors';

const vectorStore = new S3Vectors({
  // required
  vectorBucketName: process.env.S3VECTORS_BUCKET!, // e.g., 'my-vector-bucket'
  // AWS SDK v3 client config (put region/credentials here)
  clientConfig: {
    region: process.env.AWS_REGION!, // e.g., 'us-east-1'
    // credentials can rely on the default AWS provider chain
  },
  // optional: non-filterable metadata keys applied at index creation
  nonFilterableMetadataKeys: ['content'],
});

// Create a new index
await vectorStore.createIndex({
  indexName: 'my-index', // '_' will be replaced with '-' and letters lowercased
  dimension: 1536,
  metric: 'cosine', // 'euclidean' is also supported ('dotproduct' is not)
});

// Add vectors
const vectors = [
  [0.1, 0.2 /* ... */],
  [0.3, 0.4 /* ... */],
];
const metadata = [
  { text: 'doc1', genre: 'documentary', year: 2023, createdAt: new Date('2024-01-01') },
  { text: 'doc2', genre: 'comedy', year: 2021 },
];

// If ids are omitted, UUIDs will be generated
const ids = await vectorStore.upsert({
  indexName: 'my-index',
  vectors,
  metadata,
});

// Query vectors
const results = await vectorStore.query({
  indexName: 'my-index',
  queryVector: [0.1, 0.2 /* ... */],
  topK: 10, // (S3 Vectors limit is 30)
  // S3 Vectors JSON-based filter syntax ($eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $exists, $and, $or)
  filter: {
    $and: [{ genre: { $in: ['documentary', 'comedy'] } }, { year: { $gte: 2020 } }],
  },
  includeVector: false, // set true to include raw vectors in the response
});

// Results example
for (const r of results) {
  console.log(r.id, r.score, r.metadata /*, r.vector (when includeVector: true)*/);
}

// (optional) close the underlying HTTP handler
await vectorStore.disconnect();
```

## Documentation

- [@mastra/s3vectors documentation](https://mastra.ai/reference/vectors/s3vectors)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/s3vectors/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
