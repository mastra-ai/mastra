---
title: "MongoDB Storage"
description: Documentation for the MongoDB storage implementation in Mastra.
---

# MongoDB Storage

The MongoDB storage implementation provides a scalable storage solution using MongoDB databases with support for both document storage and vector operations.

## Installation

```bash copy
npm install @mastra/mongodb@latest
```

## Usage

Ensure you have a MongoDB Atlas Local (via Docker) or MongoDB Atlas Cloud instance with Atlas Search enabled. MongoDB 7.0+ is recommended.

```typescript copy showLineNumbers
import { MongoDBStore } from "@mastra/mongodb";

const storage = new MongoDBStore({
  url: process.env.MONGODB_URL,
  dbName: process.env.MONGODB_DATABASE,
});
```

## Parameters

<PropertiesTable
content={[
{
name: "url",
type: "string",
description:
"MongoDB connection string (e.g., mongodb+srv://user:password@cluster.mongodb.net)",
isOptional: false,
},
{
name: "dbName",
type: "string",
description:
"The name of the database you want the storage to use.",
isOptional: false,
},
{
name: "options",
type: "MongoClientOptions",
description:
"MongoDB client options for advanced configuration (SSL, connection pooling, etc.). See advanced configuration [here](https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/).",
isOptional: true,
}
]}
/>

## Constructor Examples

You can instantiate `MongoDBStore` in the following ways:

```ts
import { MongoDBStore } from "@mastra/mongodb";

// Basic connection without custom options
const store1 = new MongoDBStore({
  url: "mongodb+srv://user:password@cluster.mongodb.net",
  dbName: "mastra_storage",
});

// Using connection string with options
const store2 = new MongoDBStore({
  url: "mongodb+srv://user:password@cluster.mongodb.net",
  dbName: "mastra_storage",
  options: {
    retryWrites: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  },
});
```

## Additional Notes

### Collection Management

The storage implementation handles collection creation and management automatically. It creates the following collections:

- `mastra_workflow_snapshot`: Stores workflow state and execution data
- `mastra_evals`: Stores evaluation results and metadata
- `mastra_threads`: Stores conversation threads
- `mastra_messages`: Stores individual messages
- `mastra_traces`: Stores telemetry and tracing data
- `mastra_scorers`: Stores scoring and evaluation data
- `mastra_resources`: Stores resource working memory data

## Vector Search Capabilities

MongoDB storage includes built-in vector search capabilities for AI applications:

### Vector Index Creation

```typescript copy
import { MongoDBVector } from "@mastra/mongodb";

const vectorStore = new MongoDBVector({
  url: process.env.MONGODB_URL,
  dbName: process.env.MONGODB_DATABASE,
});

// Create a vector index for embeddings
await vectorStore.createIndex({
  indexName: "document_embeddings",
  dimension: 1536,
});
```

### Vector Operations

```typescript copy
// Store vectors with metadata
await vectorStore.upsert({
  indexName: "document_embeddings",
  vectors: [
    {
      id: "doc-1",
      values: [0.1, 0.2, 0.3, ...], // 1536-dimensional vector
      metadata: {
        title: "Document Title",
        category: "technical",
        source: "api-docs",
      },
    },
  ],
});

// Similarity search
const results = await vectorStore.query({
  indexName: "document_embeddings",
  vector: queryEmbedding,
  topK: 5,
  filter: {
    category: "technical",
  },
});
```
