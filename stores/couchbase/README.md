# @mastra/couchbase

A Mastra vector store implementation for Couchbase with vector similarity search and advanced metadata filtering capabilities. It offers two distinct vector stores:

- **`CouchbaseQueryStore`**: Utilizes Couchbase's Hyperscale or Composite Vector Indexes. Recommended for most use cases.
- **`CouchbaseSearchStore`**: Leverages Couchbase's Search Vector Index for vector search.

## Features

- Vector similarity search with advanced filtering
- **Two vector store implementations**: `CouchbaseQueryStore` (Hyperscale or Composite Vector Indexes) and `CouchbaseSearchStore` (Search Vector Index)
- Support for Hyperscale and Composite vector index types with `CouchbaseQueryStore`.
- Cosine, Euclidean (L2), and Dot Product distance metrics.
- Search index management (create, list, describe, delete).
- Compatible with Couchbase Capella and Couchbase Server (see version details below).
- Built-in telemetry support.

## Prerequisites

- Couchbase Server 8.0+ or Couchbase Capella cluster with Search Vector Index and/or Hyperscale/Composite Vector Indexes available
- **Note**: For `CouchbaseQueryStore`, Couchbase Server 8.0.0+ is required.
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

## Choosing Your Store and Index Type

The primary choice is between `CouchbaseSearchStore` and `CouchbaseQueryStore`. If you choose `CouchbaseQueryStore`, you then select between a Hyperscale or Composite index.

### `CouchbaseSearchStore` vs. `CouchbaseQueryStore`

| Feature               | `CouchbaseSearchStore`          | `CouchbaseQueryStore`                                               |
| --------------------- | ------------------------------------- | ------------------------------------------------------------------------- |
| **Best For**          | Hybrid search and high recall rates.  | Vector-first workloads, complex filtering, and high QPS performance.      |
| **Couchbase Version** | 7.6.4+                                | 8.0.0+                                                                    |
| **Filtering**         | Pre-filtering with flexible ordering. | Pre-filtering with `WHERE` clauses (Composite) or post-filtering (Hyperscale). |
| **Scalability**       | Up to 10 million vectors.             | Up to billions of vectors (Hyperscale).                                        |

### Choosing the Right Index Type for `CouchbaseQueryStore`

#### Hyperscale Vector Indexes

- **Best for**: Pure vector searches like content discovery, recommendations, and semantic search.
- **Use when**: You primarily perform vector-only queries without complex scalar filtering.
- **Features**: High performance with a low memory footprint, optimized for concurrent operations, and designed to scale to billions of vectors.

#### Composite Vector Indexes

- **Best for**: Filtered vector searches that combine vector similarity with scalar value filtering.
- **Use when**: Your queries combine vector similarity with scalar filters that eliminate large portions of the dataset.
- **Features**: Efficient pre-filtering where scalar attributes reduce the vector comparison scope.

## Getting Started with `CouchbaseQueryStore`

This section guides you through using `CouchbaseQueryStore`, which leverages Hyperscale or Composite Vector Indexes for vector search.

**Step 1: Connect to Your Cluster**

Instantiate `CouchbaseQueryStore` with your cluster details.

```typescript
import { CouchbaseQueryStore } from '@mastra/couchbase';

const connectionString = 'couchbases://your_cluster_host?ssl=no_verify'; // Use couchbases:// for Capella/TLS, couchbase:// for local/non-TLS
const username = 'your_couchbase_user';
const password = 'your_couchbase_password';
const bucketName = 'your_vector_bucket';
const scopeName = '_default'; // Or your custom scope name
const collectionName = 'vector_data'; // Or your custom collection name

const vectorStore = new CouchbaseQueryStore({
  connectionString,
  username,
  password,
  bucketName,
  scopeName,
  collectionName,
});

console.log('CouchbaseQueryStore instance created.');
```

**Step 2: Create a Vector Index**

`CouchbaseQueryStore` supports two types of vector indexes: `hyperscale` and `composite`.

- **`hyperscale`**: A vector-optimized index for vector-first workloads. It supports post-scan filtering and simple pre-filtering, and is designed to scale to billions of vectors.
- **`composite`**: A composite index that combines vector and non-vector fields. It is best for well-defined workloads that require complex filtering, such as range lookups combined with vector search.

**Example: Creating a `hyperscale` index**

```typescript
const indexName = 'my_vector_index_hyperscale';
const vectorDimension = 1536; // Example: OpenAI embedding dimension

try {
  await vectorStore.createIndex({
    indexName: indexName,
    dimension: vectorDimension,
    metric: 'cosine', // Or 'euclidean', 'dotproduct'
    vector_index_type: 'hyperscale',
    fields_to_index: ['category', 'page'], // Metadata fields to include for filtering
  });
  console.log(`Vector index '${indexName}' created successfully.`);
} catch (error) {
  console.error(`Failed to create index '${indexName}':`, error);
}
```

**Example: Creating a `composite` index**

```typescript
const compositeIndexName = 'my_vector_index_composite';

try {
  await vectorStore.createIndex({
    indexName: compositeIndexName,
    dimension: vectorDimension,
    metric: 'cosine',
    vector_index_type: 'composite',
    fields_to_index: ['category', 'page'],
  });
  console.log(`Vector index '${compositeIndexName}' created successfully.`);
} catch (error) {
  console.error(`Failed to create index '${compositeIndexName}':`, error);
}
```

_Note_: Index creation in Couchbase is asynchronous. It might take a short while for the index to become fully built and queryable.

### Understanding Index Configuration

The `index_metadata` parameter in the `createIndex` method allows you to control how Couchbase optimizes vector storage and search. The `description` field is particularly important.

**Format**: `'IVF[<centroids>],{PQ|SQ}<settings>'`

- **Centroids (IVF)**: Controls how the dataset is subdivided for faster searches. More centroids result in faster searches but slower training. If omitted (e.g., `IVF,SQ8`), Couchbase automatically selects the number of centroids based on the dataset size.
- **Quantization (PQ/SQ)**: Compresses vectors to save memory. `SQ` (Scalar Quantization) and `PQ` (Product Quantization) offer different levels of precision and performance.

**Common Examples**:

- `IVF,SQ8`: Auto-selected centroids with 8-bit scalar quantization. A good default.
- `IVF1000,SQ6`: 1000 centroids with 6-bit scalar quantization.
- `IVF,PQ32x8`: Auto-selected centroids with 32 subquantizers of 8 bits each.

**Step 3: Add Your Vectors (Upsert Documents)**

The `upsert` process is the same as with `CouchbaseSearchStore`.

```typescript
const vectors = [Array(vectorDimension).fill(0.1), Array(vectorDimension).fill(0.2)];
const metadata = [
  { source: 'doc1.txt', page: 1, category: 'finance' },
  { source: 'doc2.pdf', page: 5, category: 'tech' },
];

try {
  const ids = await vectorStore.upsert({
    indexName: indexName, // Required for dimension validation
    vectors: vectors,
    metadata: metadata,
  });
  console.log('Upserted documents with IDs:', ids);
} catch (error) {
  console.error('Failed to upsert vectors:', error);
}
```

**Step 4: Find Similar Vectors (Query the Index)**

Querying with `CouchbaseQueryStore` uses the same filter syntax as `CouchbaseSearchStore`, but leverages SQL++ for execution.

```typescript
const queryVector = Array(vectorDimension).fill(0.15); // Your query vector
const k = 5; // Number of nearest neighbors to retrieve

try {
  // Vector search with metadata filtering
  const filteredResults = await vectorStore.query({
    indexName: indexName,
    queryVector: queryVector,
    topK: k,
    filter: {
      'metadata.category': { $eq: 'finance' },
      'metadata.page': { $gt: 0 },
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

_Note_: `includeVector` **IS** supported in `CouchbaseQueryStore` queries.

**Important - Filter Field Names:** When using filters, metadata fields are stored within a `metadata` object in the Couchbase document. Therefore, you must prefix your field names with `metadata.` when creating filters. For example, to filter on a field called `category` that was stored in metadata, use `'metadata.category'` in your filter expression.

_Note_: In Hyperscale or Composite vector search, the vector distance is returned instead of the score. A lower distance indicates higher similarity.

**Step 5: Manage Indexes**

You can list, describe, and delete vector indexes.

```typescript
try {
  // List all indexes on the collection
  const indexes = await vectorStore.listIndexes();
  console.log('Available vector indexes:', indexes);

  // Get details about our specific vector index
  const stats = await vectorStore.describeIndex({ indexName: indexName });
  console.log(`Stats for index '${indexName}':`, stats);

  // Delete the index
  await vectorStore.deleteIndex({ indexName: indexName });
  console.log(`Vector index '${indexName}' deleted.`);
} catch (error) {
  console.error('Failed to manage indexes:', error);
}
```

## Getting Started with `CouchbaseSearchStore`

Let's set up `@mastra/couchbase` to store and search vectors with filtering capabilities in your Couchbase cluster using the Search Vector Index.

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

console.log('CouchbaseSearchStore instance created.');
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

_Best practice_: Implement a delay or polling mechanism to ensure the index is ready using simple delay approach (`await new Promise(resolve => setTimeout(resolve, 2000));`).

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

Document ID: <generated_or_provided_id>

    ```json
    {
        "embedding": [0.1, ...],
        "metadata": { "source": "doc1.txt", "page": 1, "category": "finance" }
    }
    ```

Document ID: <generated_or_provided_id>

    ```json
    {
        "embedding": [0.2, 0.1],
        "metadata": { "source": "doc2.pdf", "page": 5, "text": "...", "category": "tech" },
        "content": "This is the text content." // 'content' field added if metadata.text exists
    }
    ```

**Step 4: Find Similar Vectors (Query the Index)**

Use the Search Vector Index to find documents with vectors similar to your query vector. You can also apply metadata filters to narrow down results.

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

_Note_: `includeVector` option not supported in `query()`

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

### `CouchbaseQueryStore`

**Constructor:**

```typescript
new CouchbaseQueryStore({
  connectionString: string,
  username: string,
  password: string,
  bucketName: string,
  scopeName: string,
  collectionName: string,
});
```

**Key Methods:**

- `createIndex({ indexName, dimension, metric?, fields_to_index?, vector_index_type?, index_metadata? })` - Create a Hyperscale or Composite vector index. `index_metadata` can be used to provide a `description` for centroids and quantization.
- `upsert({ indexName, vectors, metadata?, ids? })` - Add/update vectors.
- `query({ indexName, queryVector, topK?, filter?, includeVector? })` - Search similar vectors with filtering.
- `listIndexes()`, `describeIndex({ indexName })`, `deleteIndex({ indexName })` - Index management.
- `updateVector({ id, update })`, `deleteVector({ id })` - Vector management.
- `disconnect()` - Close connection.

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
- **Field Indexing:** For `CouchbaseSearchStore`, only `fields_to_index` fields can be filtered. Use `metadata.` prefix in filters. For `CouchbaseQueryStore`, fields must be included in the Hyperscale or Composite Vector Index to be efficiently filtered.
- **Document Structure:** Vectors stored in `embedding` field, metadata in `metadata` field.
- **Composite Index Filtering**: When using Composite indexes, scalar filters take precedence over vector similarity.
- **Limitations:**
  - `CouchbaseSearchStore`:
    - `includeVector` not supported in queries
    - Advanced operators (`$in`, `$regex`, etc.) not yet supported
    - Index count, is not yet supported and so returns -1
  - `CouchbaseQueryStore`:
    - Advanced operators (`$in`, `$regex`, etc.) not yet supported
    - Score is distance (lower is better).
    - Index count, is not yet supported and so returns -1

## Links
## Advanced Couchbase Vector Usage

- **Distance Metrics Mapping:**
  - The `metric` parameter in `createIndex` and `describeIndex` uses Mastra terms. These map to Couchbase index definitions as follows:
    - `cosine` → `cosine`
    - `euclidean` → `l2_norm`
    - `dotproduct` → `dot_product`
- **Index Definition Details:**
  - The `createIndex` method constructs a Couchbase Search Index definition tailored for vector search. It indexes the `embedding` field (as type `vector`) and the `content` field (as type `text`), targeting documents within the specified `scopeName.collectionName`. It enables `store` and `docvalues` for these fields. For fine-grained control over the index definition (e.g., different analyzers, type mappings), you would need to use the Couchbase SDK or UI directly.
- **Document Structure:**
  - Vectors are stored in the `embedding` field.
  - Metadata is stored in the `metadata` field.
  - If `metadata.text` exists, it's copied to the `content` field.
  - The `query` results currently return stored fields like `metadata` and `content` in the `metadata` property of the result object, but **not** the `embedding` field itself.

## API Reference (`CouchbaseVector` Methods)

- `constructor(cnn_string, username, password, bucketName, scopeName, collectionName)`: Creates a new instance and prepares the connection promise.
- `getCollection()`: (Primarily internal) Establishes connection lazily and gets the Couchbase `Collection` object.
- `createIndex({ indexName, dimension, metric? })`: Creates or updates a Couchbase Search Index configured for vector search on the collection.
- `upsert({ indexName, vectors, metadata?, ids? })`: Upserts documents containing vectors and metadata into the Couchbase collection. Returns the document IDs used.
- `query({ indexName, queryVector, topK?, filter?, includeVector? })`: Queries the specified Search Index for similar vectors using Couchbase Vector Search. **Note:** `filter` and `includeVector` options are **not currently supported**.
- `updateVector({ indexName, id, update })`: Updates a specific vector entry by its ID with new vector data and/or metadata. **Note:** Filter-based updates are not yet implemented.
- `deleteVector({ indexName, id })`: Deletes a single vector by its ID.
- `deleteVectors({ indexName, ids })`: Deletes multiple vectors by their IDs. **Note:** Filter-based deletion is not yet implemented.
- `listIndexes()`: Lists the names of all Search Indexes in the cluster. Returns fully qualified names (e.g., `bucket.scope.index`).
- `describeIndex({ indexName })`: Gets the configured dimension, metric (Mastra name), and document count for a specific Search Index (using its short name).
- `deleteIndex({ indexName })`: Deletes a Search Index (using its short name).
- `disconnect()`: Closes the Couchbase client connection. Should be called when done using the store.

## Configuration Details

- **Required Constructor Parameters:**
  - `cnn_string`: Couchbase connection string (e.g., `couchbases://host?ssl=no_verify`, `couchbase://localhost`). See [Couchbase SDK Docs](https://docs.couchbase.com/nodejs-sdk/current/hello-world/connect.html) for all options.
  - `username`: Couchbase user with necessary permissions (see Prerequisites).
  - `password`: Password for the Couchbase user.
  - `bucketName`: Name of the target Couchbase Bucket.
  - `scopeName`: Name of the target Scope within the Bucket.
  - `collectionName`: Name of the target Collection within the Scope.
- **Internal Connection Profile:** The library internally uses the `wanDevelopment` configuration profile when connecting via the Couchbase SDK. This profile adjusts certain timeouts suitable for development and some cloud environments. For production tuning, consider modifying the library or managing the SDK connection externally.

## Notes & Considerations

- **Couchbase Version:** This integration requires **Couchbase Server 7.6.4+** or a compatible Couchbase Capella cluster with the **Search Vector Index** available. And **Couchbase Server 8.0+** or a compatible Couchbase Capella cluster with the **Hyperscale or Composite Vector Index**.
- **Index Creation:** The `createIndex` method defines and creates/updates a Couchbase Search index configured for vector search. Index creation in Couchbase is asynchronous; allow a short time after creation before querying, especially on larger datasets.
- **Data Storage:** Vectors and metadata are stored together as fields within standard Couchbase documents in the specified Collection.
  - The default field name for the vector embedding is `"embedding"`.
  - The default field name for metadata is `"metadata"`.
  - If `metadata` contains a `text` property, its value is also copied to a top-level `"content"` field in the document, which is indexed by the Search index created by this library.
- **Upsert Independence:** The `upsert` operation adds/modifies documents directly in the Collection. It **does not depend on the Search index** existing at the time of upsert. You can insert data before or after creating the index. Couchbase allows multiple Search indexes over the same Collection data.
- **Dimension Validation:**
  - This library _attempts_ to track the dimension specified during the last `createIndex` call within the same `CouchbaseVector` instance. If tracked, it performs a basic length check during `upsert`.
  - However, Couchbase itself **does not enforce vector dimensions at data ingest time**. Upserting a vector with a dimension different from what an index expects **will not cause an error during `upsert`**. Errors related to dimension mismatches will typically occur only during the `query` operation against that specific index.
- **Asynchronous Operations & Consistency:** Be mindful of the asynchronous nature of index building and potential replication delays in Couchbase, especially in multi-node clusters. Add appropriate checks or delays in your application logic if immediate consistency after writes is required for subsequent queries.
  - **Index Creation Delays:** After creating a vector search index, allow sufficient time (typically 1-5 seconds for small datasets, longer for larger ones) before querying against it. The delay needed depends on data volume, cluster resources, and replication settings.
  - **Vector Insertion Processing:** When upserting large batches of vectors, the documents may not be immediately queryable. Consider implementing appropriate wait times or retry mechanisms when performing queries immediately after bulk inserts.
  - **Production Considerations:** For production environments, implement a more robust polling mechanism to check index status rather than fixed timeouts.
- **Current Limitations:**
  - **Metadata Filtering:** The `filter` parameter in the `query` method is **not yet supported** by this library. Filtering must be done client-side after retrieving results or by using the Couchbase SDK's Search capabilities directly for more complex queries.
  - **Returning Vectors:** The `includeVector: true` option in the `query` method is **not yet supported**. To retrieve the vector embedding, you must fetch the full document using its ID (returned in the query results) via the Couchbase SDK's Key-Value operations (`collection.get(id)`).
  - **Index Count:** The `describeIndex` method currently **returns -1 for the count** of indexed documents. Use Couchbase tools (UI, CLI, SQL++ query on the collection, Search API) for accurate index statistics.

## Related Links

- [Couchbase Vector Search Docs](https://docs.couchbase.com/cloud/vector-search/vector-search.html)
- [Couchbase Node.js SDK](https://docs.couchbase.com/nodejs-sdk/current/hello-world/start-using-sdk.html)
