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

### More operations

```typescript
// Update a single vector (merge metadata or replace vector)
await vectorStore.updateVector({
  indexName: 'my-index',
  id: ids[0],
  update: {
    // vector: [/* new embedding of length 1536 */],
    metadata: { tags: ['updated'] },
  },
});

// Delete a single vector
await vectorStore.deleteVector({
  indexName: 'my-index',
  id: ids[1],
});

// Describe index (dimension/metric/count)
const stats = await vectorStore.describeIndex({ indexName: 'my-index' });

// List indexes in the bucket
const indexNames = await vectorStore.listIndexes();

// Delete index
await vectorStore.deleteIndex({ indexName: 'my-index' });
```

## Configuration

The S3 Vectors store reads configuration from the constructor and standard AWS SDK sources:

- `vectorBucketName` (required): The **vector bucket** name dedicated to S3 Vectors.
- `clientConfig` (optional): AWS SDK v3 `S3VectorsClientConfig` (e.g., `region`, `credentials`).
- `nonFilterableMetadataKeys` (optional): Keys that are **stored** but **not filterable** at query time.
  _These are applied when an index is created._

> **Tip**
> Index names are normalized by the library: underscores are replaced with hyphens and names are lower-cased.

## Features

- Purpose-built vector storage with S3-grade durability and elasticity
- Sub-second similarity search (`cosine` / `euclidean`)
- Rich **metadata filtering** with JSON operators (`$and`, `$or`, `$in`, …)
- IAM/SCP-based access control in the `s3vectors` namespace
- Automatic optimization for writes/updates/deletes as data scales

## Methods

- `connect(): Promise<void>` / `disconnect(): Promise<void>` — No-ops for interface parity (disconnect closes the underlying HTTP handler)
- `createIndex({ indexName, dimension, metric? })` → `Promise<void>`
  _After creation, index name/dimension/metric/non-filterable keys cannot be changed._
- `upsert({ indexName, vectors, metadata?, ids? })` → `Promise<string[]>`
  _Dimensions are validated against the index; Dates in metadata are serialized to epoch millis._
- `query({ indexName, queryVector, topK?, filter?, includeVector? })` → `Promise<QueryResult[]>`
  _`score` is derived from distance so that “higher is better”._
- `updateVector({ indexName, id, update: { vector?, metadata? } })` → `Promise<void>`
  _Performs Get→merge→Put (Put is full replace)._
- `deleteVector({ indexName, id })` → `Promise<void>`
- `listIndexes()` → `Promise<string[]>`
- `describeIndex({ indexName })` → `Promise<IndexStats>`
  _Returns `{ dimension, metric, count }`._
- `deleteIndex({ indexName })` → `Promise<void>`

## Related Links

- Amazon S3 Vectors – Working with vector buckets & indexes:  
  https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors.html
- Limitations and restrictions:  
  https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-limitations.html
- Vector indexes:  
  https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-indexes.html
- Metadata filtering:  
  https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-metadata-filtering.html
- Vector bucket naming rules:  
  https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-buckets-naming.html
- Managing vector bucket policies:  
  https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-bucket-policy.html
- Actions, resources, and condition keys for Amazon S3 Vectors:  
  https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazons3vectors.html
