# MastraStorage

The storage package provides a flexible and extensible storage system for Mastra, implementing persistent storage capabilities for workflows, threads, messages, and evaluation data.

## Architecture

### Observability previews

The ClickHouse, PostgreSQL and DuckDB observability adapters store nullable `inputPreview`, `outputPreview` and `errorPreview` columns. At insertion, `buildStoredPreview` in `@mastra/core/storage` keeps a nonblank supplied preview, otherwise generates one from the payload. Both are trimmed and limited to 100 characters plus an ellipsis when truncated.

List reads use stored previews and generate a fallback in adapter TypeScript only for NULL previews. A stored empty string means there is nothing to preview and does not trigger a payload lookup. Fallback never writes to the database, and raw payloads are omitted from preview list responses. Full/detail responses keep their existing behavior.

Adapters detect the core helper at runtime without raising their core dependency requirement. When it is absent, they preserve supplied preview fields and skip generation and preview-only payload lookups. PostgreSQL still applies its normal text-column normalization for unsupported NUL and invalid surrogate characters.

### Core Components

1. **Base Storage Class (`MastraStorage`)**
   - Abstract base class defining the storage interface
   - Handles table initialization and management
   - Provides common storage operations for all implementations

2. **LibSQL Implementation (`DefaultStorage`)**
   - Concrete implementation using LibSQL/SQLite
   - Supports both in-memory and file-based storage
   - Implements atomic transactions for data integrity
   - Used automatically by Memory if no storage is provided

### Supported Tables

The storage system manages four primary tables:

1. **Workflow Snapshots** (`workflow_snapshot`)
   - Stores workflow state and execution data
   - Uses composite primary key (workflow_name, run_id)
   - Supports JSON serialization for complex state objects

2. **Messages** (`messages`)
   - Stores conversation messages
   - Links messages to threads via thread_id
   - Maintains message order via createdAt timestamp

3. **Threads** (`threads`)
   - Manages conversation threads
   - Supports metadata storage
   - Tracks creation and update timestamps

4. **Evaluations** (`evals`)
   - Stores evaluation results and metadata
   - Captures input/output data
   - Records test execution details

## Usage

### Basic Setup

When using Memory, DefaultStorage is used automatically if no storage is provided:

```typescript
import { Memory } from '@mastra/memory';

const memory = new Memory({
  options: {
    lastMessages: 10,
    semanticRecall: true,
  },
});
```

For direct storage usage or custom configurations:

```typescript
import { DefaultStorage } from '@mastra/core/storage';

const storage = new DefaultStorage({
  name: 'my-storage',
  config: {
    url: 'file:my-database.db', // or 'file::memory:' for in-memory
  },
});

// Storage will auto-initialize tables on first use
await storage.init();
```

### Working with Threads

```typescript
const memoryStorage = await storage.getStore('memory');

// Create a new thread
const thread = await memoryStorage.createThread({
  resourceId: 'resource-123',
  title: 'My Thread',
  metadata: { key: 'value' },
});

// Get thread by ID
const retrievedThread = await memoryStorage.getThreadById({
  threadId: thread.id,
});

// Update thread
await memoryStorage.updateThread({
  id: thread.id,
  title: 'Updated Title',
  metadata: { newKey: 'newValue' },
});
```

### Working with Messages

```typescript
const memoryStorage = await storage.getStore('memory');

// Save messages
await memoryStorage.saveMessages({
  messages: [
    {
      id: 'msg-1',
      threadId: thread.id,
      role: 'user',
      content: [{ type: 'text', text: 'Hello' }],
      createdAt: new Date(),
    },
  ],
});

// Get thread messages with pagination
const result = await memoryStorage.listMessages({
  threadId: thread.id,
  page: 0,
  perPage: 50,
});

console.log(result.messages); // MastraDBMessage[]
console.log(result.total); // Total count
console.log(result.hasMore); // Whether more pages exist
```

### Working with Workflow Snapshots

```typescript
const workflowsStorage = await storage.getStore('workflows');

// Save workflow state
await workflowsStorage.persistWorkflowSnapshot({
  workflowName: 'my-workflow',
  runId: 'run-123',
  snapshot: {
    value: { currentState: 'running' },
    context: {
      stepResults: {},
      attempts: {},
      triggerData: {},
    },
    activePaths: [],
    runId: 'run-123',
    timestamp: Date.now(),
  },
});

// Load workflow state
const snapshot = await workflowsStorage.loadWorkflowSnapshot({
  workflowName: 'my-workflow',
  runId: 'run-123',
});
```
