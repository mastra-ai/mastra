# @mastra/cloudflare-d1

A Mastra store for Cloudflare D1 SQL databases, supporting threads, messages, workflows, evaluations, and traces with robust SQL features.

## Features

- Thread and message storage using SQL tables
- True sorted order and filtering via SQL queries
- Rich metadata support (JSON-encoded)
- Timestamp tracking for all records
- Workflow snapshot persistence
- Trace and evaluation storage
- Efficient batch operations (with prepared statements)
- Automatic JSON serialization/deserialization for metadata and custom fields
- Error handling and logging for all operations
- Supports both Cloudflare Workers D1 Binding and REST API

## Prerequisites

- Access to a Cloudflare account with D1 enabled
- D1 database created and configured
- For Workers binding: Worker configured with D1 binding
- For REST API: Cloudflare API Token with D1 permissions

## Installation

```bash
pnpm add @mastra/cloudflare-d1
```

## Usage

### With Workers D1 Binding

```typescript
import { D1Store } from '@mastra/cloudflare-d1';

const store = new D1Store({
  binding: env.DB, // D1Database binding from Worker environment
  tablePrefix: 'mastra_', // optional
});
```

### With REST API

```typescript
import { D1Store } from '@mastra/cloudflare-d1';

const store = new D1Store({
  accountId: '<your-account-id>',
  databaseId: '<your-d1-database-id>',
  apiToken: '<your-api-token>',
  tablePrefix: 'mastra_', // optional
});
```

## Supported Methods

### Thread Operations

- `saveThread(thread)`: Create or update a thread
- `getThreadById({ threadId })`: Get a thread by ID
- `getThreadsByResourceId({ resourceId })`: Fetch all threads associated with a resource.
- `updateThread({ id, title, metadata })`: Update the title and/or metadata of a thread.
- `deleteThread({ threadId })`: Delete a thread and all its messages.

### Message Operations

- `saveMessages({ messages })`: Save multiple messages in a batch operation (uses prepared statements).
- `getMessages({ threadId, selectBy? })`: Retrieve messages for a thread, with optional filtering (e.g., last N, include surrounding messages).

### Workflow Operations

- `persistWorkflowSnapshot({ workflowName, runId, snapshot })`: Save workflow state for a given workflow/run.
- `loadWorkflowSnapshot({ workflowName, runId })`: Load persisted workflow state.

### Trace/Evaluation Operations

- `getTraces({ name?, scope?, page, perPage, attributes? })`: Query trace records with optional filters and pagination.
- `getEvalsByAgentName({ agentName, type? })`: Query evaluation results by agent name.

### Utility

- `clearTable({ tableName })`: Remove all records from a logical table.
- `batchInsert({ tableName, records })`: Batch insert multiple records.
- `insert({ tableName, record })`: Insert a single record into a table.

---

## Data Types

The D1 store supports the following data types:

- `text`: String
- `timestamp`: ISO8601 string (converted to/from Date)
- `uuid`: String
- `jsonb`: JSON-encoded object
- `integer`: Integer (for internal counters, etc)

All metadata and custom fields are automatically serialized/deserialized as JSON.

---

## Configuration Reference

| Option      | Type       | Description                          |
| ----------- | ---------- | ------------------------------------ |
| binding     | D1Database | D1 Workers binding (for Workers)     |
| accountId   | string     | Cloudflare Account ID (for REST API) |
| databaseId  | string     | D1 Database ID (for REST API)        |
| apiToken    | string     | Cloudflare API Token (for REST API)  |
| tablePrefix | string     | Optional prefix for all table names  |

---

## Table/Namespace Mapping

Each logical Mastra table maps to a SQL table in D1 (with optional prefix):

- `mastra_threads` — stores threads
- `mastra_messages` — stores messages
- `mastra_workflow_snapshot` — stores workflow snapshots
- `mastra_evals` — stores evaluations
- `mastra_traces` — stores traces

(The prefix is configurable via `tablePrefix`.)

---

## Limitations

- No multi-statement transactions (D1 currently supports single statements per query)
- No advanced SQL joins (D1 is SQLite-based, but some features may be limited)
- Batch operations are processed in chunks, not truly atomic
- Some REST API operations may be slower than Workers binding
- D1 is in beta and may have evolving limitations
- No vector search capabilities
- Note: D1 has specific limitations and behaviors, please refer to the official Cloudflare D1 documentation for more information.

## Cleanup / Disconnect

No explicit cleanup is required. Connections are managed by the platform.
