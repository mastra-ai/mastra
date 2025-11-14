# MastraStorage

The storage package provides a flexible and extensible storage system for Mastra, implementing persistent storage capabilities for workflows, threads, messages, and evaluation data.

## Architecture

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

### Composite Storage

You can use a default store for most domains and override specific domains. This is useful when you want to use different storage backends for different domains (e.g., LibSQL for most domains, PostgreSQL for observability):

```typescript
import { MastraStorage } from '@mastra/core/storage';
import { LibSQLStore } from '@mastra/libsql';
import { ObservabilityStorage } from '@mastra/pg';
import pgPromise from 'pg-promise';

// Default store for all domains
const defaultStore = new LibSQLStore({
  id: 'default-storage',
  url: 'file:./default.db',
});

// Override observability to use PostgreSQL
const pgp = pgPromise();
const sharedDbClient = pgp({
  connectionString: 'postgresql://user:password@localhost:5432/mastra',
});

const observabilityStorage = new ObservabilityStorage({
  client: sharedDbClient,
  schema: 'public',
});

const storage = new MastraStorage({
  id: 'mastra-storage',
  name: 'Mastra Storage',
  default: defaultStore, // Default for workflows, memory, evals
  stores: {
    observability: observabilityStorage, // Override observability
  },
});

// Only domains that are explicitly provided or exist in the default store will be initialized
await storage.init();
```

### Working with Threads

```typescript
// Create a new thread
const thread = await storage.createThread({
  resourceId: 'resource-123',
  title: 'My Thread',
  metadata: { key: 'value' },
});

// Get thread by ID
const memoryStore = await storage.getStore('memory');
const retrievedThread = await memoryStore?.getThreadById({
  threadId: thread.id,
});

// Update thread
const memoryStore = await storage.getStore('memory');
await memoryStore?.updateThread({
  id: thread.id,
  title: 'Updated Title',
  metadata: { newKey: 'newValue' },
});
```

### Working with Messages

```typescript
// Save messages
const memoryStore = await storage.getStore('memory');
await memoryStore?.saveMessages({
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
const result = await memoryStore?.listMessages({
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
// Save workflow state
const workflowsStore = await storage.getStore('workflows');
await workflowsStore?.createWorkflowSnapshot({
  workflowId: 'my-workflow',
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
const store = await storage.getStore('workflows');

const snapshot = await store?.getWorkflowSnapshot({
  workflowId: 'my-workflow',
  runId: 'run-123',
});
```
