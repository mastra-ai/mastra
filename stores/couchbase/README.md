# @mastra/couchbase

A Mastra vector store implementation for Couchbase with vector similarity search and advanced metadata filtering capabilities.

## Features

- Vector similarity search with filtering support
- Cosine, Euclidean (L2), and Dot Product distance metrics
- Search index management (create, list, describe, delete)
- Compatible with Couchbase Server 7.6.4+ and Couchbase Capella
- Built-in telemetry support

## Prerequisites

- Couchbase Server 7.6.4+ or Couchbase Capella cluster with Search Service enabled
- Configured Bucket, Scope, and Collection
- User credentials with Read and Write access
- Node.js 18+

## Installation

```bash
npm install @mastra/couchbase
# or using pnpm
pnpm add @mastra/couchbase
# or using yarn
yarn add @mastra/couchbase
```

## Getting Started: A Quick Tutorial

Let's set up `@mastra/couchbase` to store and search vectors with filtering capabilities in your Couchbase cluster.

**Step 1: Connect to Your Cluster**

Instantiate `CouchbaseSearchStore` with your cluster details.

```typescript
import { CouchbaseSearchStore } from '@mastra/couchbase';
// For backward compatibility, CouchbaseVector is also available:
// import { CouchbaseVector } from '@mastra/couchbase';

const connectionString = 'couchbases://your_cluster_host?ssl=no_verify'; // Use couchbases:// for Capella/TLS, couchbase:// for local/non-TLS
const username = 'your_couchbase_user';
const password = 'your_couchbase_password';
const bucketName = 'your_vector_bucket';
const scopeName = '_default'; // Or your custom scope name
const collectionName = 'vector_data'; // Or your custom collection name

const vectorStore = new CouchbaseSearchStore({
  connectionString,
  username,
  password,
  bucketName,
  scopeName,
  collectionName,
});

console.log('CouchbaseSearchStore instance created. Connecting...');
```

_Note_: The actual connection to Couchbase happens lazily upon the first operation.

**Step 2: Create a Vector Search Index**

Define and create a Search Index specifically for vector search on your collection. You can also specify additional metadata fields to index for filtering.

```typescript
const indexName = 'my_vector_search_index';
const vectorDimension = 1536; // Example: OpenAI embedding dimension

try {
  await vectorStore.createIndex({
    indexName: indexName,
    dimension: vectorDimension,
    metric: 'cosine', // Or 'euclidean', 'dotproduct'
    fields_to_index: [
      { name: 'category', type: 'text' },
      { name: 'page', type: 'number' },
      { name: 'timestamp', type: 'datetime' },
    ], // Optional: metadata fields to enable filtering on
  });
  console.log(`Search index '${indexName}' created or updated successfully.`);
} catch (error) {
  console.error(`Failed to create index '${indexName}':`, error);
}
```

_Note_: Index creation in Couchbase is asynchronous. It might take a short while for the index to become fully built and queryable.

**Important:** Filtering will only work on metadata fields that are explicitly indexed using the `fields_to_index` parameter. Fields not included in the index definition cannot be used for filtering operations.

_Best practice_: Implement a delay or polling mechanism to ensure the index is ready using simple delay approach (`await new Promise(resolve => setTimeout(resolve, 2000));`) or implement a more robust solution that polls the index status

**Step 3: Add Your Vectors (Upsert Documents)**

Store your vectors and metadata as documents in the designated Couchbase collection.

```typescript
const vectors = [
  Array(vectorDimension).fill(0.1), // Replace with your actual vectors
  Array(vectorDimension).fill(0.2),
];
const metadata = [
  { source: 'doc1.txt', page: 1, category: 'finance' },
  { source: 'doc2.pdf', page: 5, text: 'This is the text content.', category: 'tech' }, // Example with text
];

try {
  // IDs will be auto-generated UUIDs if not provided
  const ids = await vectorStore.upsert({
    indexName: indexName, // Required for dimension validation if tracked
    vectors: vectors,
    metadata: metadata,
    // ids: ['custom_id_1', 'custom_id_2'] // Optionally provide your own IDs
  });
  console.log('Upserted documents with IDs:', ids);
} catch (error) {
  console.error('Failed to upsert vectors:', error);
}
```

_Note_: For large vector batches, Couchbase may need time to process and index all documents. Consider implementing appropriate waiting periods before querying newly inserted vectors like a simple delay (`await new Promise(resolve => setTimeout(resolve, 1000));`) for smaller batches

Document structure in Couchbase will resemble:

```
Document ID: <generated_or_provided_id>
  {
    "embedding": [0.1, ...],
    "metadata": { "source": "doc1.txt", "page": 1, "category": "finance" }
  }
```

```
Document ID: <generated_or_provided_id>
  {
    "embedding": [0.2, ...],
    "metadata": { "source": "doc2.pdf", "page": 5, "text": "...", "category": "tech" },
    "content": "This is the text content." // 'content' field added if metadata.text exists
  }
```

**Step 4: Find Similar Vectors (Query the Index)**

Use the Search Index to find documents with vectors similar to your query vector. You can also apply metadata filters to narrow down results.

```typescript
const queryVector = Array(vectorDimension).fill(0.15); // Your query vector
const k = 5; // Number of nearest neighbors to retrieve

try {
  // Basic vector similarity search
  const results = await vectorStore.query({
    indexName: indexName,
    queryVector: queryVector,
    topK: k,
  });
  console.log(`Found ${results.length} similar results:`, results);

  // Vector search with metadata filtering
  const filteredResults = await vectorStore.query({
    indexName: indexName,
    queryVector: queryVector,
    topK: k,
    filter: {
      'metadata.category': { $eq: 'finance' },
      'metadata.page': { $gt: 1, $lt: 10 },
    },
  });
  console.log(`Found ${filteredResults.length} filtered results:`, filteredResults);
} catch (error) {
  console.error('Failed to query vectors:', error);
}
```

**Important - Filter Field Names:** When using filters, metadata fields are stored within a `metadata` object in the Couchbase document. Therefore, you must prefix your field names with `metadata.` when creating filters. For example, to filter on a field called `category` that was stored in metadata, use `'metadata.category'` in your filter expression.

**Filtering Operators Supported:**

- **Equality:** `$eq`, `$ne`
- **Comparison:** `$gt`, `$gte`, `$lt`, `$lte` (for numbers and dates)
- **Logical:** `$and`, `$or`, `$not`, `$nor`

**Filter Examples:**

```typescript
// Text equality
{ 'metadata.category': { $eq: 'finance' } }

// Numeric range
{ 'metadata.page': { $gte: 1, $lte: 10 } }

// Date comparison
{ 'metadata.timestamp': { $gt: new Date('2024-01-01') } }

// Boolean filtering
{ 'metadata.active': { $eq: true } }

// Complex logical operations
{
  $and: [
    { 'metadata.category': { $eq: 'tech' } },
    { 'metadata.page': { $gt: 5 } }
  ]
}

// Multiple conditions with OR
{
  $or: [
    { 'metadata.category': { $eq: 'finance' } },
    { 'metadata.category': { $eq: 'tech' } }
  ]
}
```

_Note_: `includeVector` option not yet supported in `query()`

Results format:

```js
[
    {
        id: string, // Document ID
        score: number, // Similarity score (higher is better for cosine/dotproduct, lower for euclidean)
        metadata: Record<string, any> // Fields stored in the index (typically includes 'metadata', 'content')
    },
    // ... more results
]
```

**Step 5: Manage Indexes**

List, inspect, or delete your vector search indexes.

```typescript
try {
  // List all Search Indexes in the cluster (may include non-vector indexes)
  const indexes = await vectorStore.listIndexes();
  console.log('Available search indexes:', indexes);
  // Get details about our specific vector index
  for (const indexName of indexes) {
    const stats = await vectorStore.describeIndex(indexName);
    console.log(`Stats for index '${indexName}':`, stats);
  }
  // Delete the index when no longer needed
  await vectorStore.deleteIndex(indexName);
  console.log(`Search index '${indexName}' deleted.`);
} catch (error) {
  console.error('Failed to manage indexes:', error);
}
```

_Note_: Deleting Index does NOT delete the vectors in the associated Couchbase Collection

## API Reference

### `CouchbaseSearchStore`

**Constructor:**

```typescript
new CouchbaseSearchStore({
  connectionString: string,
  username: string,
  password: string,
  bucketName: string,
  scopeName: string,
  collectionName: string,
});
```

**Key Methods:**

- `createIndex({ indexName, dimension, metric?, fields_to_index? })` - Create vector search index
- `upsert({ vectors, metadata?, ids? })` - Add/update vectors
- `query({ indexName, queryVector, topK?, filter? })` - Search similar vectors with filtering
- `listIndexes()`, `describeIndex({ indexName })`, `deleteIndex({ indexName })` - Index management
- `updateVector({ id, update })`, `deleteVector({ id })` - Vector management
- `disconnect()` - Close connection

### Legacy `CouchbaseVector` (Deprecated)

⚠️ Use `CouchbaseSearchStore` for new projects. `CouchbaseVector` lacks filtering support.

## Important Notes

- **Async Operations:** Index creation and large upserts are asynchronous. Allow time for processing before querying.
- **Field Indexing:** Only `fields_to_index` fields can be filtered. Use `metadata.` prefix in filters.
- **Document Structure:** Vectors stored in `embedding` field, metadata in `metadata` field.
- **Limitations:**
  - `includeVector` not supported in queries
  - Advanced operators (`$in`, `$regex`, etc.) not yet supported
  - Index count returns -1

## Links

- [Couchbase Vector Search Docs](https://docs.couchbase.com/cloud/vector-search/vector-search.html)
- [Couchbase Node.js SDK](https://docs.couchbase.com/nodejs-sdk/current/hello-world/start-using-sdk.html)
