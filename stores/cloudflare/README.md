# @mastra/cloudflare

Cloudflare KV store for Mastra, providing scalable and serverless storage for threads, messages, workflow snapshots, and evaluations. Supports both Cloudflare Workers KV Bindings and the REST API for flexible deployment in serverless and Node.js environments.

## Installation

```bash
npm install @mastra/cloudflare
```

## Prerequisites

- Cloudflare account with KV namespaces set up
- Node.js 16 or higher
- (Optional) Cloudflare Worker for Workers API mode

## Usage

```typescript
import { CloudflareStore } from '@mastra/cloudflare';

// Using Workers Binding API
const store = new CloudflareStore({
  bindings: {
    threads: THREADS_KV_NAMESPACE,
    messages: MESSAGES_KV_NAMESPACE,
    workflow_snapshot: WORKFLOW_KV_NAMESPACE,
    evals: EVALS_KV_NAMESPACE,
    traces: TRACES_KV_NAMESPACE,
  },
  keyPrefix: 'myapp_', // Optional
});

// Or using REST API
const store = new CloudflareStore({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  namespacePrefix: 'myapp_', // Optional
});

// Save a thread
await store.saveThread({
  id: 'thread-123',
  resourceId: 'resource-456',
  title: 'My Thread',
  metadata: { key: 'value' },
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Add messages
await store.saveMessages({
  messages: [
    {
      id: 'msg-1',
      threadId: 'thread-123',
      content: 'Hello Cloudflare!',
      role: 'user',
      createdAt: new Date(),
    },
  ],
});

// Query messages
const messages = await store.getMessages({ threadId: 'thread-123' });
```

## Configuration

- **Workers API**: Use the `bindings` option to pass KV namespaces directly (for Cloudflare Workers).
- **REST API**: Use `accountId`, `apiToken`, and (optionally) `namespacePrefix` for server-side usage.
- `keyPrefix`/`namespacePrefix`: Useful for isolating environments (e.g., dev/test/prod).

## Features

### Storage Features

- Thread and message storage with JSON support
- Rich metadata support (JSON-encoded)
- Timestamp tracking for all records
- Workflow snapshot persistence
- Trace and evaluation storage
- Sorted message order using simulated sorted sets
- Supports both Cloudflare Workers KV Bindings and REST API
- Automatic JSON serialization/deserialization for metadata and custom fields
- Error handling and logging for all operations

### Consistency & Performance

- Eventually consistent (see Limitations)
- Low-latency access via Workers Binding API
- Scalable and serverless

## Supported Methods

### Thread Operations

- `saveThread(thread)`: Create or update a thread
- `getThreadById({ threadId })`: Get a thread by ID
- `getThreadsByResourceId({ resourceId })`: Fetch all threads associated with a resource.
- `updateThread({ id, title, metadata })`: Update thread title and metadata
- `deleteThread({ threadId })`: Delete a thread and its messages

### Message Operations

- `saveMessages({ messages })`: Save multiple messages
- `getMessages({ threadId, selectBy? })`: Get messages for a thread with optional filtering (last N, includes, etc)

### Workflow Operations

- `persistWorkflowSnapshot({ workflowName, runId, snapshot })`: Save workflow state for a given workflow/run.
- `loadWorkflowSnapshot({ workflowName, runId })`: Load ed workflow state.

### Trace Operations

- `getTraces({ name?, scope?, page, perPage, attributes? })`: Query trace records with optional filters and pagination.

### Utility

- `clearTable({ tableName })`: Remove all records from a logical table
- `batchInsert({ tableName, records })`: Batch insert multiple records.
- `insert({ tableName, record })`: Insert a single record into a table.

## Data Types

- `text`: String
- `timestamp`: ISO8601 string (converted to/from Date)
- `uuid`: String
- `jsonb`: JSON-encoded object

All records are stored as JSON in KV, with automatic serialization/deserialization for metadata, arrays, and custom fields.

## Configuration Reference

- **Workers Binding API**: Use the `bindings` option to pass KV namespaces directly (for Cloudflare Workers).
- **REST API**: Use `accountId`, `apiToken`, and (optionally) `namespacePrefix` for server-side usage.
- `keyPrefix`/`namespacePrefix`: Useful for isolating environments (e.g., dev/test/prod).

Example:

```typescript
const store = new CloudflareStore({
  bindings: { ... }, // for Workers
  keyPrefix: 'dev_',
});
// or
const store = new CloudflareStore({
  accountId: '...',
  apiToken: '...',
  namespacePrefix: 'prod_',
});
```

## Table/Namespace Mapping

Each logical Mastra table (threads, messages, workflow_snapshot, evals, traces) maps to a separate KV namespace. Keys are structured as `${prefix}${tableName}:${primaryKey}` or `${prefix}${tableName}:${threadId}:${messageId}` for messages. The prefix is set by `keyPrefix`/`namespacePrefix`.

## Limitations

- **Eventual Consistency:** Cloudflare KV is eventually consistent; concurrent operations may not be immediately visible across all reads.
- **No Transactions:** Atomic multi-key operations are not supported.
- **Rate Limits:** Large objects or high-frequency updates may be subject to Cloudflare KV rate limits.
- **Query Limitations:** No native querying; all filtering is done in-memory after fetching keys/records.
- **Best for:** Use for serverless, low-latency, and moderate-volume workloads. For relational or strongly consistent needs, consider D1 or a SQL backend.

## Cloudflare-Specific Notes

- **Workers Binding API** is recommended for production Workers deployments (low-latency, no API token required at runtime).
- **REST API** is ideal for server-side Node.js or test environments.
- Ensure your KV namespaces are provisioned and accessible by your Worker or API token.
- Namespaces and keys are automatically created as needed.

## Cleanup/Disconnect

No explicit cleanup or disconnect is required; Cloudflare KV is fully managed.
