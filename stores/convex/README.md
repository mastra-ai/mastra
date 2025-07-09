# Convex Storage for Mastra

This package provides a Convex DB implementation of the Mastra storage interface, allowing you to use Convex as a reactive storage backend for your Mastra applications.

## Features

- Full implementation of the Mastra storage interface (threads, messages, traces, evals, workflow runs)
- Real-time subscription capabilities for reactive updates
- Schema definitions for all Mastra entities
- Compatible with existing Mastra patterns and APIs

## Installation

```bash
npm install @mastra/convex
# or
yarn add @mastra/convex
# or
pnpm add @mastra/convex
```

## Setup

### 1. Configure Convex

First, set up a Convex project:

```bash
npx convex init
```

This creates a `convex/` directory in your project with the necessary configuration.

### 2. Add Schema and Functions

Copy the schema and function files from this package to your Convex directory:

- `convex/schema.ts` - Schema definitions for all Mastra entities
- `convex/threads.ts` - Thread operations
- `convex/messages.ts` - Message operations
- `convex/traces.ts` - Trace operations
- `convex/evals.ts` - Evaluation operations
- `convex/workflowRuns.ts` - Workflow run operations
- `convex/system.ts` - System utilities

### 3. Deploy Convex Backend

```bash
npx convex dev
```

For production:

```bash
npx convex deploy
```

### 4. Configure ConvexStorage

```typescript
import { ConvexStorage } from '@mastra/convex';
import { api } from './convex/_generated/api';

const storage = new ConvexStorage({
  convexUrl: process.env.CONVEX_URL,
  api,
});
```

## Usage

### Basic Operations

```typescript
// Create a thread
const thread = await storage.saveThread({
  thread: {
    id: 'thread-123',
    resourceId: 'resource-456',
    title: 'Conversation Thread',
    metadata: { key: 'value' },
    createdAt: Date.now(),
  },
});

// Get a thread
const retrievedThread = await storage.getThreadById({ threadId: 'thread-123' });

// Save a message
const message = await storage.saveMessage({
  message: {
    id: 'message-789',
    threadId: 'thread-123',
    type: 'user',
    content: 'Hello, world!',
    createdAt: Date.now(),
  },
});

// Get messages for a thread
const messages = await storage.getMessages({ threadId: 'thread-123' });
```

### Real-time Subscriptions

```typescript
// Subscribe to thread changes
const unsubscribeThread = storage.subscribeToThread('thread-123', thread => {
  console.log('Thread updated:', thread);
});

// Subscribe to thread messages
const unsubscribeMessages = storage.subscribeToThreadMessages('thread-123', messages => {
  console.log('Messages updated:', messages);
});

// Later, when done
unsubscribeThread();
unsubscribeMessages();
```

### Advanced Operations

```typescript
// Save a trace
const trace = await storage.saveTrace({
  trace: {
    id: 'trace-001',
    threadId: 'thread-123',
    transportId: 'transport-001',
    runId: 'run-001',
    rootRunId: 'root-run-001',
    spans: [],
    spanDurations: {},
    properties: {},
    timestamp: Date.now(),
  },
});

// Save an evaluation
const evaluation = await storage.saveEval({
  evalData: {
    id: 'eval-001',
    threadId: 'thread-123',
    agentName: 'test-agent',
    type: 'live',
    metadata: { source: 'unit-test' },
    data: { score: 0.95 },
    createdAt: Date.now(),
  },
});

// Save a workflow run
const workflowRun = await storage.saveWorkflowRun({
  workflowRun: {
    id: 'run-001',
    workflowName: 'test-workflow',
    resourceId: 'resource-456',
    stateType: 'completed',
    state: { result: 'success' },
    createdAt: Date.now(),
  },
});
```

### Schema Management

In Convex, schema is managed through the `convex/schema.ts` file. The schema definition includes:

- `threads` table for conversation threads
- `messages` table for thread messages
- `traces` table for trace data
- `evals` table for evaluations
- `workflowRuns` table for workflow runs

Each table has appropriate indexes for efficient queries.

## Environment Variables

- `CONVEX_URL`: URL of your Convex deployment (e.g., "https://cheerful-lemur-123.convex.cloud")

## Error Handling

ConvexStorage wraps all Convex client errors in descriptive error messages, making it easier to troubleshoot issues with your storage operations.

## Testing

This package includes comprehensive tests for all storage interface methods:

```bash
npm test
```

## Limitations

- Convex doesn't support dynamic table creation or schema modification at runtime
- Complex queries may require optimization for large datasets
- The subscription pattern is specific to Convex and not available in other Mastra storage backends

## License

MIT
