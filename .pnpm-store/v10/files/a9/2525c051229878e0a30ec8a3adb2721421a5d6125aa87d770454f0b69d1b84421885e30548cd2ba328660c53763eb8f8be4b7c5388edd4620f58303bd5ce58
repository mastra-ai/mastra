<br />
<p align="center">
  <a href="https://supabase.io">
        <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--light.svg">
      <img alt="Supabase Logo" width="300" src="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/logo-preview.jpg">
    </picture>
  </a>

  <h1 align="center">Supabase Storage JS SDK</h1>

  <h3 align="center">JavaScript SDK to interact with Supabase Storage, including file storage and vector embeddings.</h3>

  <p align="center">
    <a href="https://supabase.com/docs/guides/storage">Guides</a>
    ·
    <a href="https://supabase.com/docs/reference/javascript/storage-createbucket">Reference Docs</a>
    ·
    <a href="https://supabase.github.io/supabase-js/storage-js/v2/spec.json">TypeDoc</a>
  </p>
</p>

<div align="center">

[![Build](https://github.com/supabase/supabase-js/workflows/CI/badge.svg)](https://github.com/supabase/supabase-js/actions?query=branch%3Amaster)
[![Package](https://img.shields.io/npm/v/@supabase/storage-js)](https://www.npmjs.com/package/@supabase/storage-js)
[![License: MIT](https://img.shields.io/npm/l/@supabase/supabase-js)](#license)
[![pkg.pr.new](https://pkg.pr.new/badge/supabase/storage-js)](https://pkg.pr.new/~/supabase/storage-js)

</div>

## Features

- **File Storage**: Upload, download, list, move, and delete files
- **Access Control**: Public and private buckets with fine-grained permissions
- **Signed URLs**: Generate time-limited URLs for secure file access
- **Image Transformations**: On-the-fly image resizing and optimization
- **Vector Embeddings**: Store and query high-dimensional embeddings with similarity search
- **Analytics Buckets**: Iceberg table-based buckets optimized for analytical queries and data processing

## Quick Start Guide

### Installing the module

```bash
npm install @supabase/storage-js
```

### Connecting to the storage backend

There are two ways to use the Storage SDK:

#### Option 1: Via Supabase Client (Recommended)

If you're already using `@supabase/supabase-js`, access storage through the client:

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://<project_ref>.supabase.co',
  '<your-anon-key>'
)

// Access storage
const storage = supabase.storage

// Access different bucket types
const regularBucket = storage.from('my-bucket')
const vectorBucket = storage.vectors.from('embeddings-bucket')
const analyticsBucket = storage.analytics // Analytics API
```

#### Option 2: Standalone StorageClient

For applications that only need storage functionality:

```js
import { StorageClient } from '@supabase/storage-js'

const STORAGE_URL = 'https://<project_ref>.supabase.co/storage/v1'
const SERVICE_KEY = '<service_role>' //! service key, not anon key

const storageClient = new StorageClient(STORAGE_URL, {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
})

// Access different bucket types
const regularBucket = storageClient.from('my-bucket')
const vectorBucket = storageClient.vectors.from('embeddings-bucket')
const analyticsBucket = storageClient.analytics // Analytics API
```

> **When to use each approach:**
> - Use `supabase.storage` when working with other Supabase features (auth, database, etc.)
> - Use `new StorageClient()` for storage-only applications or when you need fine-grained control

### Understanding Bucket Types

Supabase Storage supports three types of buckets, each optimized for different use cases:

#### 1. Regular Storage Buckets (File Storage)

Standard buckets for storing files, images, videos, and other assets.

```js
// Create regular storage bucket
const { data, error } = await storageClient.createBucket('my-files', {
  public: false
})

// Upload files
await storageClient.from('my-files').upload('avatar.png', file)
```

**Use cases:** User uploads, media assets, documents, backups

#### 2. Vector Buckets (Embeddings Storage)

Specialized buckets for storing and querying high-dimensional vector embeddings.

```js
// Create vector bucket
await storageClient.vectors.createBucket('embeddings-prod')

// Create index and insert vectors
const bucket = storageClient.vectors.from('embeddings-prod')
await bucket.createIndex({
  indexName: 'documents',
  dimension: 1536,
  distanceMetric: 'cosine'
})
```

**Use cases:** Semantic search, AI-powered recommendations, similarity matching

**[See full Vector Embeddings documentation below](#vector-embeddings)**

#### 3. Analytics Buckets

Specialized buckets using Apache Iceberg table format, optimized for analytical queries and large-scale data processing.

```js
// Create analytics bucket
await storageClient.analytics.createBucket('analytics-data')

// List analytics buckets
const { data, error } = await storageClient.analytics.listBuckets()

// Delete analytics bucket
await storageClient.analytics.deleteBucket('analytics-data')
```

**Use cases:** Time-series data, analytical queries, data lakes, large-scale data processing, business intelligence

**[See full Analytics Buckets documentation below](#analytics-buckets)**

---

### Handling resources

#### Handling Storage Buckets

- Create a new Storage bucket:

  ```js
  const { data, error } = await storageClient.createBucket(
    'test_bucket', // Bucket name (must be unique)
    { public: false } // Bucket options
  )
  ```

- Retrieve the details of an existing Storage bucket:

  ```js
  const { data, error } = await storageClient.getBucket('test_bucket')
  ```

- Update a new Storage bucket:

  ```js
  const { data, error } = await storageClient.updateBucket(
    'test_bucket', // Bucket name
    { public: false } // Bucket options
  )
  ```

- Remove all objects inside a single bucket:

  ```js
  const { data, error } = await storageClient.emptyBucket('test_bucket')
  ```

- Delete an existing bucket (a bucket can't be deleted with existing objects inside it):

  ```js
  const { data, error } = await storageClient.deleteBucket('test_bucket')
  ```

- Retrieve the details of all Storage buckets within an existing project:

  ```js
  const { data, error } = await storageClient.listBuckets()
  ```

#### Handling Files

- Upload a file to an existing bucket:

  ```js
  const fileBody = ... // load your file here

  const { data, error } = await storageClient.from('bucket').upload('path/to/file', fileBody)
  ```

  > Note:  
  > The path in `data.Key` is prefixed by the bucket ID and is not the value which should be passed to the `download` method in order to fetch the file.  
  > To fetch the file via the `download` method, use `data.path` and `data.bucketId` as follows:
  >
  > ```javascript
  > const { data, error } = await storageClient.from('bucket').upload('/folder/file.txt', fileBody)
  > // check for errors
  > const { data2, error2 } = await storageClient.from(data.bucketId).download(data.path)
  > ```

  > Note: The `upload` method also accepts a map of optional parameters. For a complete list see the [Supabase API reference](https://supabase.com/docs/reference/javascript/storage-from-upload).

- Download a file from an exisiting bucket:

  ```js
  const { data, error } = await storageClient.from('bucket').download('path/to/file')
  ```

- List all the files within a bucket:

  ```js
  const { data, error } = await storageClient.from('bucket').list('folder')
  ```

  > Note: The `list` method also accepts a map of optional parameters. For a complete list see the [Supabase API reference](https://supabase.com/docs/reference/javascript/storage-from-list).

- Replace an existing file at the specified path with a new one:

  ```js
  const fileBody = ... // load your file here

  const { data, error } = await storageClient
    .from('bucket')
    .update('path/to/file', fileBody)
  ```

  > Note: The `upload` method also accepts a map of optional parameters. For a complete list see the [Supabase API reference](https://supabase.com/docs/reference/javascript/storage-from-upload).

- Move an existing file:

  ```js
  const { data, error } = await storageClient
    .from('bucket')
    .move('old/path/to/file', 'new/path/to/file')
  ```

- Delete files within the same bucket:

  ```js
  const { data, error } = await storageClient.from('bucket').remove(['path/to/file'])
  ```

- Create signed URL to download file without requiring permissions:

  ```js
  const expireIn = 60

  const { data, error } = await storageClient
    .from('bucket')
    .createSignedUrl('path/to/file', expireIn)
  ```

- Retrieve URLs for assets in public buckets:

  ```js
  const { data, error } = await storageClient.from('public-bucket').getPublicUrl('path/to/file')
  ```

## Analytics Buckets

Supabase Storage provides specialized analytics buckets using Apache Iceberg table format, optimized for analytical workloads and large-scale data processing. These buckets are designed for data lake architectures, time-series data, and business intelligence applications.

### What are Analytics Buckets?

Analytics buckets use the Apache Iceberg open table format, providing:
- **ACID transactions** for data consistency
- **Schema evolution** without data rewrites
- **Time travel** to query historical data
- **Efficient metadata management** for large datasets
- **Optimized for analytical queries** rather than individual file operations

### When to Use Analytics Buckets

**Use analytics buckets for:**
- Time-series data (logs, metrics, events)
- Data lake architectures
- Business intelligence and reporting
- Large-scale batch processing
- Analytical workloads requiring ACID guarantees

**Use regular storage buckets for:**
- User file uploads (images, documents, videos)
- Individual file management
- Content delivery
- Simple object storage needs

### Quick Start

You can access analytics functionality through the `analytics` property on your storage client:

#### Via Supabase Client

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
)

// Access analytics operations
const analytics = supabase.storage.analytics

// Create an analytics bucket
const { data, error } = await analytics.createBucket('analytics-data')
if (error) {
  console.error('Failed to create analytics bucket:', error.message)
} else {
  console.log('Created bucket:', data.name)
}
```

#### Via StorageClient

```typescript
import { StorageClient } from '@supabase/storage-js'

const storageClient = new StorageClient('https://your-project.supabase.co/storage/v1', {
  apikey: 'YOUR_API_KEY',
  Authorization: 'Bearer YOUR_TOKEN',
})

// Access analytics operations
const analytics = storageClient.analytics

// Create an analytics bucket
await analytics.createBucket('analytics-data')
```

### API Reference

#### Create Analytics Bucket

Creates a new analytics bucket using Iceberg table format:

```typescript
const { data, error } = await analytics.createBucket('my-analytics-bucket')

if (error) {
  console.error('Error:', error.message)
} else {
  console.log('Created bucket:', data)
}
```

**Returns:**
```typescript
{
  data: {
    id: string
    type: 'ANALYTICS'
    format: string
    created_at: string
    updated_at: string
  } | null
  error: StorageError | null
}
```

#### List Analytics Buckets

Retrieves all analytics buckets in your project with optional filtering and pagination:

```typescript
const { data, error } = await analytics.listBuckets({
  limit: 10,
  offset: 0,
  sortColumn: 'created_at',
  sortOrder: 'desc',
  search: 'prod'
})

if (data) {
  console.log(`Found ${data.length} analytics buckets`)
  data.forEach(bucket => {
    console.log(`- ${bucket.id} (created: ${bucket.created_at})`)
  })
}
```

**Parameters:**
- `limit?: number` - Maximum number of buckets to return
- `offset?: number` - Number of buckets to skip (for pagination)
- `sortColumn?: 'id' | 'name' | 'created_at' | 'updated_at'` - Column to sort by
- `sortOrder?: 'asc' | 'desc'` - Sort direction
- `search?: string` - Search term to filter bucket names

**Returns:**
```typescript
{
  data: AnalyticBucket[] | null
  error: StorageError | null
}
```

**Example with Pagination:**

```typescript
// Fetch first page
const firstPage = await analytics.listBuckets({
  limit: 100,
  offset: 0,
  sortColumn: 'created_at',
  sortOrder: 'desc'
})

// Fetch second page
const secondPage = await analytics.listBuckets({
  limit: 100,
  offset: 100,
  sortColumn: 'created_at',
  sortOrder: 'desc'
})
```

#### Delete Analytics Bucket

Deletes an analytics bucket. The bucket must be empty before deletion.

```typescript
const { data, error } = await analytics.deleteBucket('old-analytics-bucket')

if (error) {
  console.error('Failed to delete:', error.message)
} else {
  console.log('Bucket deleted:', data.message)
}
```

**Returns:**
```typescript
{
  data: { message: string } | null
  error: StorageError | null
}
```

> **Note:** A bucket cannot be deleted if it contains data. You must empty the bucket first.

### Error Handling

Analytics buckets use the same error handling pattern as the rest of the Storage SDK:

```typescript
const { data, error } = await analytics.createBucket('my-bucket')

if (error) {
  console.error('Error:', error.message)
  console.error('Status:', error.status)
  console.error('Status Code:', error.statusCode)
  // Handle error appropriately
}
```

#### Throwing Errors

You can configure the client to throw errors instead of returning them:

```typescript
const analytics = storageClient.analytics
analytics.throwOnError()

try {
  const { data } = await analytics.createBucket('my-bucket')
  // data is guaranteed to be present
  console.log('Success:', data)
} catch (error) {
  if (error instanceof StorageApiError) {
    console.error('API Error:', error.statusCode, error.message)
  }
}
```

### TypeScript Types

The library exports TypeScript types for analytics buckets:

```typescript
import type {
  AnalyticBucket,
  BucketType,
  StorageError,
} from '@supabase/storage-js'

// AnalyticBucket type
interface AnalyticBucket {
  id: string
  type: 'ANALYTICS'
  format: string
  created_at: string
  updated_at: string
}
```

### Common Patterns

#### Checking if a Bucket Exists

```typescript
async function bucketExists(bucketName: string): Promise<boolean> {
  const { data, error } = await analytics.listBuckets({
    search: bucketName
  })

  if (error) {
    console.error('Error checking bucket:', error.message)
    return false
  }

  return data?.some(bucket => bucket.id === bucketName) ?? false
}
```

#### Creating Bucket with Error Handling

```typescript
async function ensureAnalyticsBucket(bucketName: string) {
  // Try to create the bucket
  const { data, error } = await analytics.createBucket(bucketName)

  if (error) {
    // Check if bucket already exists (conflict error)
    if (error.statusCode === '409') {
      console.log(`Bucket '${bucketName}' already exists`)
      return { success: true, created: false }
    }

    // Other error occurred
    console.error('Failed to create bucket:', error.message)
    return { success: false, error }
  }

  console.log(`Created new bucket: '${bucketName}'`)
  return { success: true, created: true, data }
}
```

#### Listing All Buckets with Pagination

```typescript
async function getAllAnalyticsBuckets() {
  const allBuckets: AnalyticBucket[] = []
  let offset = 0
  const limit = 100

  while (true) {
    const { data, error } = await analytics.listBuckets({
      limit,
      offset,
      sortColumn: 'created_at',
      sortOrder: 'desc'
    })

    if (error) {
      console.error('Error fetching buckets:', error.message)
      break
    }

    if (!data || data.length === 0) {
      break
    }

    allBuckets.push(...data)

    // If we got fewer results than the limit, we've reached the end
    if (data.length < limit) {
      break
    }

    offset += limit
  }

  return allBuckets
}
```

## Vector Embeddings

Supabase Storage provides built-in support for storing and querying high-dimensional vector embeddings, powered by S3 Vectors. This enables semantic search, similarity matching, and AI-powered applications without needing a separate vector database.

> **Note:** Vector embeddings functionality is available in `@supabase/storage-js` v2.76 and later.

### Features

- **Vector Buckets**: Organize vector indexes into logical containers
- **Vector Indexes**: Define schemas with configurable dimensions and distance metrics
- **Batch Operations**: Insert/update/delete up to 500 vectors per request
- **Similarity Search**: Query for nearest neighbors using cosine, euclidean, or dot product distance
- **Metadata Filtering**: Store and filter vectors by arbitrary JSON metadata
- **Pagination**: Efficiently scan large vector datasets
- **Parallel Scanning**: Distribute scans across multiple workers for high throughput
- **Cross-platform**: Works in Node.js, browsers, and edge runtimes

### Quick Start

You can access vector functionality in three ways, depending on your use case:

#### Option 1: Via Supabase Client (Most Common)

If you're using the full Supabase client:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
)

// Access vector operations through storage
const vectors = supabase.storage.vectors

// Create a vector bucket
await vectors.createBucket('embeddings-prod')

// Create an index
const bucket = vectors.from('embeddings-prod')
await bucket.createIndex({
  indexName: 'documents-openai',
  dataType: 'float32',
  dimension: 1536,
  distanceMetric: 'cosine',
})

// Insert vectors
const index = bucket.index('documents-openai')
await index.putVectors({
  vectors: [
    {
      key: 'doc-1',
      data: { float32: [0.1, 0.2, 0.3 /* ...1536 dimensions */] },
      metadata: { title: 'Introduction', category: 'docs' },
    },
  ],
})

// Query similar vectors
const { data, error } = await index.queryVectors({
  queryVector: { float32: [0.15, 0.25, 0.35 /* ...1536 dimensions */] },
  topK: 5,
  returnDistance: true,
  returnMetadata: true,
})

if (data) {
  data.matches.forEach((match) => {
    console.log(`${match.key}: distance=${match.distance}`)
    console.log('Metadata:', match.metadata)
  })
}
```

#### Option 2: Via StorageClient

If you're using the standalone `StorageClient` for storage operations, access vectors through the `vectors` property:

```typescript
import { StorageClient } from '@supabase/storage-js'

const storageClient = new StorageClient('https://your-project.supabase.co/storage/v1', {
  apikey: 'YOUR_API_KEY',
  Authorization: 'Bearer YOUR_TOKEN',
})

// Access vector operations
const vectors = storageClient.vectors

// Use the same API as shown in Option 1
await vectors.createBucket('embeddings-prod')
const bucket = vectors.from('embeddings-prod')
// ... rest of operations
```

#### Option 3: Standalone Vector Client

For vector-only applications that don't need regular file storage operations:

```typescript
import { StorageVectorsClient } from '@supabase/storage-js'

// Initialize standalone vector client
const vectorClient = new StorageVectorsClient('https://your-project.supabase.co/storage/v1', {
  headers: { Authorization: 'Bearer YOUR_TOKEN' },
})

// Use the same API as shown in Option 1
await vectorClient.createBucket('embeddings-prod')
const bucket = vectorClient.from('embeddings-prod')
// ... rest of operations
```

> **When to use each approach:**
>
> - **Option 1**: When using other Supabase features (auth, database, realtime)
> - **Option 2**: When working with both file storage and vectors
> - **Option 3**: For dedicated vector-only applications without file storage

### API Reference

#### Client Initialization

```typescript
const vectorClient = new StorageVectorsClient(url, options?)
```

**Options:**

- `headers?: Record<string, string>` - Custom HTTP headers (e.g., Authorization)
- `fetch?: Fetch` - Custom fetch implementation

#### Vector Buckets

Vector buckets are top-level containers for organizing vector indexes.

##### Create Bucket

```typescript
const { data, error } = await vectorClient.createBucket('my-bucket')
```

##### Get Bucket

```typescript
const { data, error } = await vectorClient.getBucket('my-bucket')
console.log('Created at:', new Date(data.vectorBucket.creationTime! * 1000))
```

##### List Buckets

```typescript
const { data, error } = await vectorClient.listBuckets({
  prefix: 'prod-',
  maxResults: 100,
})

// Pagination
if (data?.nextToken) {
  const next = await vectorClient.listBuckets({ nextToken: data.nextToken })
}
```

##### Delete Bucket

```typescript
// Bucket must be empty (all indexes deleted first)
const { error } = await vectorClient.deleteBucket('my-bucket')
```

#### Vector Indexes

Vector indexes define the schema for embeddings including dimension and distance metric.

##### Create Index

```typescript
const bucket = vectorClient.from('my-bucket')

await bucket.createIndex({
  indexName: 'my-index',
  dataType: 'float32',
  dimension: 1536,
  distanceMetric: 'cosine', // 'cosine' | 'euclidean' | 'dotproduct'
  metadataConfiguration: {
    nonFilterableMetadataKeys: ['raw_text', 'internal_id'],
  },
})
```

**Distance Metrics:**

- `cosine` - Cosine similarity (normalized dot product)
- `euclidean` - Euclidean distance (L2 norm)
- `dotproduct` - Dot product similarity

##### Get Index

```typescript
const { data, error } = await bucket.getIndex('my-index')
console.log('Dimension:', data?.index.dimension)
console.log('Distance metric:', data?.index.distanceMetric)
```

##### List Indexes

```typescript
const { data, error } = await bucket.listIndexes({
  prefix: 'documents-',
  maxResults: 100,
})
```

##### Delete Index

```typescript
// Deletes index and all its vectors
await bucket.deleteIndex('my-index')
```

#### Vector Operations

##### Insert/Update Vectors (Upsert)

```typescript
const index = vectorClient.from('my-bucket').index('my-index')

await index.putVectors({
  vectors: [
    {
      key: 'unique-id-1',
      data: {
        float32: [
          /* 1536 numbers */
        ],
      },
      metadata: {
        title: 'Document Title',
        category: 'technical',
        page: 1,
      },
    },
    // ... up to 500 vectors per request
  ],
})
```

**Limitations:**

- 1-500 vectors per request
- Vectors must match index dimension
- Keys must be unique within index

##### Get Vectors by Key

```typescript
const { data, error } = await index.getVectors({
  keys: ['doc-1', 'doc-2', 'doc-3'],
  returnData: true, // Include embeddings
  returnMetadata: true, // Include metadata
})

data?.vectors.forEach((v) => {
  console.log(v.key, v.metadata)
})
```

##### Query Similar Vectors (ANN Search)

```typescript
const { data, error } = await index.queryVectors({
  queryVector: {
    float32: [
      /* 1536 numbers */
    ],
  },
  topK: 10,
  filter: {
    category: 'technical',
    published: true,
  },
  returnDistance: true,
  returnMetadata: true,
})

// Results ordered by similarity
data?.matches.forEach((match) => {
  console.log(`${match.key}: distance=${match.distance}`)
})
```

**Filter Syntax:**
The `filter` parameter accepts arbitrary JSON for metadata filtering. Non-filterable keys (configured at index creation) cannot be used in filters but can still be returned.

##### List/Scan Vectors

```typescript
// Simple pagination
let nextToken: string | undefined
do {
  const { data } = await index.listVectors({
    maxResults: 500,
    nextToken,
    returnMetadata: true,
  })

  console.log('Batch:', data?.vectors.length)
  nextToken = data?.nextToken
} while (nextToken)

// Parallel scanning (4 workers)
const workers = [0, 1, 2, 3].map(async (segmentIndex) => {
  const { data } = await index.listVectors({
    segmentCount: 4,
    segmentIndex,
    returnMetadata: true,
  })
  return data?.vectors || []
})

const results = await Promise.all(workers)
const allVectors = results.flat()
```

**Limitations:**

- `maxResults`: 1-1000 (default: 500)
- `segmentCount`: 1-16
- Response may be limited by 1MB size

##### Delete Vectors

```typescript
await index.deleteVectors({
  keys: ['doc-1', 'doc-2', 'doc-3'],
  // ... up to 500 keys per request
})
```

### Error Handling

The library uses a consistent error handling pattern:

```typescript
const { data, error } = await vectorClient.createBucket('my-bucket')

if (error) {
  console.error('Error:', error.message)
  console.error('Status:', error.status)
  console.error('Code:', error.statusCode)
}
```

#### Error Codes

| Code                         | HTTP | Description             |
| ---------------------------- | ---- | ----------------------- |
| `InternalError`              | 500  | Internal server error   |
| `S3VectorConflictException`  | 409  | Resource already exists |
| `S3VectorNotFoundException`  | 404  | Resource not found      |
| `S3VectorBucketNotEmpty`     | 400  | Bucket contains indexes |
| `S3VectorMaxBucketsExceeded` | 400  | Bucket quota exceeded   |
| `S3VectorMaxIndexesExceeded` | 400  | Index quota exceeded    |

#### Throwing Errors

You can configure the client to throw errors instead:

```typescript
const vectorClient = new StorageVectorsClient(url, options)
vectorClient.throwOnError()

try {
  const { data } = await vectorClient.createBucket('my-bucket')
  // data is guaranteed to be present
} catch (error) {
  if (error instanceof StorageVectorsApiError) {
    console.error('API Error:', error.statusCode)
  }
}
```

### Advanced Usage

#### Scoped Clients

Create scoped clients for cleaner code:

```typescript
// Bucket-scoped operations
const bucket = vectorClient.from('embeddings-prod')
await bucket.createIndex({
  /* ... */
})
await bucket.listIndexes()

// Index-scoped operations
const index = bucket.index('documents-openai')
await index.putVectors({
  /* ... */
})
await index.queryVectors({
  /* ... */
})
```

#### Custom Fetch

Provide a custom fetch implementation:

```typescript
import { StorageVectorsClient } from '@supabase/storage-js'

const vectorClient = new StorageVectorsClient(url, {
  fetch: customFetch,
  headers: {
    /* ... */
  },
})
```

#### Batch Processing

Process large datasets in batches:

```typescript
async function insertLargeDataset(vectors: VectorObject[]) {
  const batchSize = 500

  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize)
    await index.putVectors({ vectors: batch })
    console.log(`Inserted ${i + batch.length}/${vectors.length}`)
  }
}
```

#### Float32 Validation

Ensure vectors are properly normalized to float32:

```typescript
import { normalizeToFloat32 } from '@supabase/storage-js'

const vector = normalizeToFloat32([0.1, 0.2, 0.3 /* ... */])
```

### Type Definitions

The library exports comprehensive TypeScript types:

```typescript
import type {
  VectorBucket,
  VectorIndex,
  VectorData,
  VectorObject,
  VectorMatch,
  VectorMetadata,
  DistanceMetric,
  ApiResponse,
  StorageVectorsError,
} from '@supabase/storage-js'
```

## Development

This package is part of the [Supabase JavaScript monorepo](https://github.com/supabase/supabase-js). To work on this package:

### Building

#### Build Scripts Overview

The storage-js package uses multiple build scripts to generate different module formats for various JavaScript environments:

| Script         | Description                 | Output                                                          |
| -------------- | --------------------------- | --------------------------------------------------------------- |
| `build`        | **Complete build pipeline** | Runs all build steps in sequence                                |
| `build:main`   | **CommonJS build**          | `dist/main/` - Node.js compatible CommonJS modules              |
| `build:module` | **ES Modules build**        | `dist/module/` - Modern ES6 modules with TypeScript definitions |
| `build:umd`    | **UMD build**               | `dist/umd/` - Universal Module Definition for browsers/CDN      |
| `clean`        | **Clean build artifacts**   | Removes `dist/` and `docs/v2/` directories                      |
| `format`       | **Format code**             | Runs Prettier on all TypeScript files                           |

#### Running Builds

##### Complete Build (Recommended)

```bash
# From the monorepo root
npx nx build storage-js
```

This command executes the full build pipeline:

1. **Cleans** - Removes any existing build artifacts
2. **Formats** - Ensures consistent code formatting
3. **Builds CommonJS** - For Node.js environments (`dist/main/`)
4. **Builds ES Modules** - For modern bundlers (`dist/module/`)
5. **Builds UMD** - For browser script tags (`dist/umd/`)

##### Development Build with Watch Mode

```bash
# Continuously rebuild on file changes (from monorepo root)
npx nx build storage-js --watch
```

##### Individual Build Targets

For specific build outputs during development:

```bash
# Build CommonJS only (Node.js)
npx nx build:main storage-js

# Build ES Modules only (Modern bundlers)
npx nx build:module storage-js

# Build UMD only (Browser/CDN)
npx nx build:umd storage-js
```

##### Other Useful Commands

```bash
# Clean build artifacts
npx nx clean storage-js

# Format code
npx nx format storage-js

# Type checking
npx nx typecheck storage-js

# Generate documentation
npx nx docs storage-js
```

#### Build Outputs Explained

##### CommonJS (`dist/main/`)

- **Used by:** Node.js applications, older build tools
- **Entry point:** `dist/main/index.js`
- **Module format:** `require()` and `module.exports`
- **TypeScript definitions:** Included

##### ES Modules (`dist/module/`)

- **Used by:** Modern bundlers (Webpack, Rollup, Vite)
- **Entry point:** `dist/module/index.js`
- **Module format:** `import` and `export`
- **TypeScript definitions:** `dist/module/index.d.ts`
- **Benefits:** Tree-shaking, better static analysis

##### UMD (`dist/umd/`)

- **Used by:** Browser `<script>` tags, CDNs
- **Entry point:** `dist/umd/supabase.js`
- **Global variable:** `window.supabase`
- **Size:** Larger (includes all dependencies)
- **Usage example:**
  ```html
  <script src="https://unpkg.com/@supabase/storage-js/dist/umd/supabase.js"></script>
  <script>
    const { StorageClient } = window.supabase
  </script>
  ```

#### Package Exports

The package.json exports are configured to provide the right format for each environment:

```json
{
  "main": "dist/main/index.js",
  "module": "dist/module/index.js",
  "types": "dist/module/index.d.ts",
  "jsdelivr": "dist/umd/supabase.js",
  "unpkg": "dist/umd/supabase.js"
}
```

- **main** → Node.js environments (CommonJS format)
- **module** → Modern bundlers like Webpack, Vite, Rollup (ES Modules)
- **types** → TypeScript type definitions
- **jsdelivr/unpkg** → CDN usage via `<script>` tags (UMD format)

### Testing

**Important:** The storage-js tests require a local test infrastructure running in Docker. This is **NOT** the same as a regular Supabase instance - it's a specialized test setup with its own storage API, database, and Kong gateway.

#### Prerequisites

1. **Docker** must be installed and running
2. **Port availability** - The following ports must be free:
   - 5432 (PostgreSQL database)
   - 5050 (Storage API - sometimes 5000 conflicts macOS AirPlay conflict)
   - 8000 (Kong API Gateway)
   - 50020 (imgproxy for image transformations)

**Note:** If port 5000 conflicts with macOS AirPlay Receiver, the docker-compose.yml has been configured to use port 5050 instead.

#### Test Scripts Overview

| Script         | Description                       | What it does                                                      |
| -------------- | --------------------------------- | ----------------------------------------------------------------- |
| `test:storage` | **Complete test workflow**        | Runs the full test cycle: clean → start infra → run tests → clean |
| `test:suite`   | **Jest tests only**               | Runs Jest tests with coverage (requires infra to be running)      |
| `test:infra`   | **Start test infrastructure**     | Starts Docker containers for storage API, database, and Kong      |
| `test:clean`   | **Stop and clean infrastructure** | Stops all Docker containers and removes them                      |

#### Running Tests

##### Option 1: Complete Test Run (Recommended)

This handles everything automatically - starting infrastructure, running tests, and cleaning up:

```bash
# From monorepo root
npx nx test:storage storage-js
```

This command will:

1. Stop any existing test containers
2. Build and start fresh test infrastructure
3. Wait for services to be ready
4. Run all Jest tests with coverage
5. Clean up all containers after tests complete

##### Option 2: Manual Infrastructure Management

Useful for development when you want to run tests multiple times without restarting Docker:

```bash
# Step 1: Start the test infrastructure
# From root
npx nx test:infra storage-js
# This starts: PostgreSQL, Storage API, Kong Gateway, and imgproxy

# Step 2: Run tests (can run multiple times)
npx nx test:suite storage-js

# Step 3: When done, clean up the infrastructure
npx nx test:clean storage-js
```

##### Option 3: Development Mode

For actively developing and debugging tests:

```bash
# Start infrastructure once (from root)
npx nx test:infra storage-js

# Run tests in watch mode
npx nx test:suite storage-js --watch

# Clean up when done
npx nx test:clean storage-js
```

#### Test Infrastructure Details

The test infrastructure (`infra/docker-compose.yml`) includes:

- **PostgreSQL Database** (port 5432)
  - Initialized with storage schema and test data
  - Contains bucket configurations and permissions

- **Storage API** (port 5050, internal 5000)
  - Supabase Storage service for handling file operations
  - Configured with test authentication keys

- **Kong Gateway** (port 8000)
  - API gateway that routes requests to storage service
  - Handles authentication and CORS

- **imgproxy** (port 50020)
  - Image transformation service for on-the-fly image processing

#### Common Issues and Solutions

| Issue                             | Solution                                                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Port 5000 already in use          | macOS AirPlay uses this port. Either disable AirPlay Receiver in System Settings or use the modified docker-compose.yml with port 5050 |
| Port 5432 already in use          | Another PostgreSQL instance is running. Stop it or modify the port in docker-compose.yml                                               |
| "request failed, reason:" errors  | Infrastructure isn't running. Run `npx nx test:infra storage-js` first                                                                 |
| Tests fail with connection errors | Ensure Docker is running and healthy                                                                                                   |
| "Container name already exists"   | Run `npx nx test:clean storage-js` to remove existing containers                                                                       |

#### Understanding Test Failures

- **StorageUnknownError with "request failed"**: Infrastructure not running
- **Port binding errors**: Ports are already in use by other services
- **Snapshot failures**: Expected test data has changed - review and update snapshots if needed

#### What About Supabase CLI?

**No**, you don't need `supabase start` or a regular Supabase instance for these tests. The storage-js tests use their own specialized Docker setup that's lighter and focused specifically on testing the storage SDK. This test infrastructure:

- Is completely independent from any Supabase CLI projects
- Uses fixed test authentication keys
- Has predictable test data and bucket configurations
- Runs faster than a full Supabase stack
- Doesn't interfere with your local Supabase development projects

### Contributing

We welcome contributions! Please see our [Contributing Guide](../../../CONTRIBUTING.md) for details on how to get started.

For major changes or if you're unsure about something, please open an issue first to discuss your proposed changes.