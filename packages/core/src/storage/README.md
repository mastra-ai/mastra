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

### Working with Threads

```typescript
// Create a new thread
const thread = await storage.createThread({
  resourceId: 'resource-123',
  title: 'My Thread',
  metadata: { key: 'value' },
});

// Get thread by ID
const retrievedThread = await storage.getThreadById({
  threadId: thread.id,
});

// Update thread
await storage.updateThread({
  id: thread.id,
  title: 'Updated Title',
  metadata: { newKey: 'newValue' },
});
```

### Working with Messages

```typescript
// Save messages
await storage.saveMessages({
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
const result = await storage.listMessages({
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
await storage.persistWorkflowSnapshot({
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
const snapshot = await storage.loadWorkflowSnapshot({
  workflowName: 'my-workflow',
  runId: 'run-123',
});
```

## Distributed Locks (optional)

To prevent multiple app instances from resuming/restarting the same workflow run concurrently, Mastra Storage exposes optional run-lock hooks:

```typescript
// Acquire a lock
const acquired = await storage.tryAcquireWorkflowRunLock({ workflowName: 'my-workflow', runId: 'run-123' });
if (!acquired) throw new Error('Another worker holds the lock');

// Heartbeat (engine calls this automatically)
await storage.renewWorkflowRunLock({ workflowName: 'my-workflow', runId: 'run-123', ttlMs: 30 * 60_000 });

// Optional: inspect lock
const info = await storage.getWorkflowRunLock({ workflowName: 'my-workflow', runId: 'run-123' });

// Release when done
await storage.releaseWorkflowRunLock({ workflowName: 'my-workflow', runId: 'run-123' });
```

Backends can implement these using their native primitives (current implementation status):
- PostgreSQL: advisory locks (e.g., `SELECT pg_try_advisory_lock(hashtext(workflowName || ':' || runId))` and `SELECT pg_advisory_unlock(...)`).
- InMemory: a simple in-process set (best effort within a single process only).
- Other adapters: not currently enforcing locks/CAS. For production multi-instance deployments, use Postgres; otherwise, run a single instance.

Mastra’s engine calls acquire + automatic heartbeats during restart/resume and releases in a finally block. If your backend doesn’t implement a lock, these hooks behave as no-ops; do not run multiple instances against such backends.
