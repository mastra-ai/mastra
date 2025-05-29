# @mastra/couchbase

A Mastra vector store implementation for Couchbase, enabling powerful vector similarity search capabilities using the official Couchbase Node.js SDK (v4+). Leverages Couchbase Server's built-in Vector Search feature (available in version 7.6.4+).

## Features

- 🚀 Vector similarity search powered by Couchbase Search Service.
- 📐 Supports Cosine, Euclidean (L2 Norm), and Dot Product distance metrics.
- 📄 Stores vectors and associated metadata within Couchbase documents in a specified Collection.
- 🔧 Manages Couchbase Search Indexes specifically configured for vector search (Create, List, Describe, Delete).
- 🆔 Automatic UUID generation for documents if IDs are not provided during upsert.
- ☁️ Compatible with both self-hosted Couchbase Server (7.6.4+) and Couchbase Capella.
- ⚙️ Uses the official Couchbase Node.js SDK v4+.
- 📈 Built-in telemetry support for tracing operations via `@mastra/core`.

## Prerequisites

- Couchbase Server (Version 7.6.4 or higher) or Couchbase Capella cluster with the **Search Service** enabled.
- A configured **Bucket**, **Scope**, and **Collection** within your Couchbase cluster where vectors and metadata will be stored.
- Couchbase user credentials (`username`, `password`) with permissions to ([Docs](https://docs.couchbase.com/cloud/get-started/connect.html#prerequisites)):
  - Connect to the cluster.
  - Read/write documents in the specified Collection (`kv` role usually covers this).
  - Manage Search Indexes (`search_admin` role on the relevant bucket/scope).
- Node.js (v18+ recommended).

## Installation

```bash
npm install @mastra/couchbase
# or using pnpm
pnpm add @mastra/couchbase
# or using yarn
yarn add @mastra/couchbase
```

## Getting Started: A Quick Tutorial

Let's set up `@mastra/couchbase` to store and search vectors in your Couchbase cluster.

**Step 1: Connect to Your Cluster**

Instantiate `CouchbaseVector` with your cluster details.

```typescript
import { CouchbaseVector } from '@mastra/couchbase';

const connectionString = 'couchbases://your_cluster_host?ssl=no_verify'; // Use couchbases:// for Capella/TLS, couchbase:// for local/non-TLS
const username = 'your_couchbase_user';
const password = 'your_couchbase_password';
const bucketName = 'your_vector_bucket';
const scopeName = '_default'; // Or your custom scope name
const collectionName = 'vector_data'; // Or your custom collection name

const vectorStore = new CouchbaseVector({
  connectionString,
  username,
  password,
  bucketName,
  scopeName,
  collectionName,
});

console.log('CouchbaseVector instance created. Connecting...');
```

_Note_: The actual connection to Couchbase happens lazily upon the first operation.

**Step 2: Create a Vector Search Index**

Define and create a Search Index specifically for vector search on your collection.

```typescript
const indexName = 'my_vector_search_index';
const vectorDimension = 1536; // Example: OpenAI embedding dimension

try {
  await vectorStore.createIndex({
    indexName: indexName,
    dimension: vectorDimension,
    metric: 'cosine', // Or 'euclidean', 'dotproduct'
  });
  console.log(`Search index '${indexName}' created or updated successfully.`);
} catch (error) {
  console.error(`Failed to create index '${indexName}':`, error);
}
```

_Note_: Index creation in Couchbase is asynchronous. It might take a short while for the index to become fully built and queryable.

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

Use the Search Index to find documents with vectors similar to your query vector.

```typescript
const queryVector = Array(vectorDimension).fill(0.15); // Your query vector
const k = 5; // Number of nearest neighbors to retrieve
try {
  const results = await vectorStore.query({
    indexName: indexName,
    queryVector: queryVector,
    topK: k,
  });
  console.log(`Found ${results.length} similar results:`, results);
} catch (error) {
  console.error('Failed to query vectors:', error);
}
```

_Note_: Metadata `filter` and `includeVector` not yet supported in `query()`

Results format:

```
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
- `listIndexes()`: Lists the names of all Search Indexes in the cluster. Returns fully qualified names (e.g., `bucket.scope.index`).
- `describeIndex(indexName)`: Gets the configured dimension, metric (Mastra name), and document count (currently returns -1) for a specific Search Index (using its short name).
- `deleteIndex(indexName)`: Deletes a Search Index (using its short name).
- `deleteVector(indexName, id)`: Deletes a specific vector entry from an index by its ID.
- `updateVector(indexName, id, update)`: Updates a specific vector entry by its ID with new vector data and/or metadata.
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

- **Couchbase Version:** This integration requires **Couchbase Server 7.6.4+** or a compatible Couchbase Capella cluster with the **Search Service enabled**.
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

- [Couchbase Vector Search Documentation](https://docs.couchbase.com/cloud/vector-search/vector-search.html)
- [Couchbase Node.js SDK Documentation](https://docs.couchbase.com/nodejs-sdk/current/hello-world/start-using-sdk.html)
- [Couchbase Query Language (SQL++) for working with documents](https://docs.couchbase.com/server/current/n1ql/n1ql-language-reference/index.html)
- [Couchbase Search Service API / Index Definition](https://docs.couchbase.com/cloud/search/search-index-params.html)

---

## 📢 Support Policy

We truly appreciate your interest in this project!
This project is **community-maintained**, which means it's **not officially supported** by our support team.

If you need help, have found a bug, or want to contribute improvements, the best place to do that is right here — by [opening a GitHub issue](https://github.com/mastra-ai/mastra/issues) (Update this link to your project's issue tracker!).
Our support portal is unable to assist with requests related to this project, so we kindly ask that all inquiries stay within GitHub.

Your collaboration helps us all move forward together — thank you!
