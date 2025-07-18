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

## Running Convex Locally

For local development, you can run Convex using the provided Docker Compose configuration. This sets up both the Convex backend and dashboard services.

### Prerequisites

- Docker and Docker Compose installed on your system
- Node.js and npm/yarn/pnpm

### Steps

1. Start the Convex development environment:

```bash
docker-compose up -d
```

This starts:

- Convex backend service at http://localhost:3210
- Convex dashboard at http://localhost:6791

2. Configure your application to use the local Convex instance:

```typescript
const storage = new ConvexStorage({
  convexUrl: 'http://localhost:3210',
  api,
});
```

3. Access the Convex dashboard at http://localhost:6791 to view your data and manage your deployment.

### Environment Variables

The Docker Compose configuration supports several environment variables that can be set in a `.env` file:

- `PORT`: Backend port (default: 3210)
- `DASHBOARD_PORT`: Dashboard port (default: 6791)
- `SITE_PROXY_PORT`: Site proxy port (default: 3211)

## Advanced Usage

### Pagination and Filtering

For large datasets, use pagination and filtering options:

```typescript
// Get paginated messages
const paginatedMessages = await storage.getMessagesPaginated({
  threadId: 'thread-123',
  page: 1,
  perPage: 20,
});

// Get workflow runs with filters
const workflowRuns = await storage.getWorkflowRuns({
  workflowName: 'my-workflow',
  fromDate: new Date('2023-01-01'),
  toDate: new Date(),
  perPage: 10,
  page: 1,
});
```

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
