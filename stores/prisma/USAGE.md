# Prisma Storage Usage Guide

The new Prisma storage implementation provides direct access to Prisma's generated types, eliminating the need for type conversions.

## Basic Usage

```typescript
import { PrismaStore } from '@mastra/prisma';
import type { WorkflowSnapshot, Thread, Message } from '@mastra/prisma';

// Initialize the store
const store = new PrismaStore({
  databaseUrl: process.env.DATABASE_URL,
});

// Connect to database
await store.connect();

// Create a workflow snapshot - using Prisma types directly
const snapshot = await store.saveWorkflowSnapshot({
  workflowName: 'my-workflow',
  runId: 'run-123',
  snapshot: { /* your workflow state as JSON */ },
  resourceId: 'resource-1', // optional
});

// Create a thread
const thread = await store.createThread({
  id: 'thread-123',
  resourceId: 'resource-1',
  title: 'Customer Support Chat',
  metadata: JSON.stringify({ source: 'web' }),
});

// Add messages to the thread
await store.createMessages([
  {
    id: 'msg-1',
    threadId: 'thread-123',
    role: 'user',
    type: 'text',
    content: 'Hello, I need help',
  },
  {
    id: 'msg-2',
    threadId: 'thread-123',
    role: 'assistant',
    type: 'text',
    content: 'Hi! How can I assist you today?',
  },
]);

// Query with Prisma's type-safe where clauses
const recentThreads = await store.getThreadsByResourceId('resource-1', {
  orderBy: { createdAt: 'desc' },
  take: 10,
});

// Create AI spans for observability
await store.createAISpan({
  traceId: 'trace-123',
  spanId: 'span-456',
  name: 'agent.execute',
  spanType: 1, // Your span type enum value
  startedAt: new Date(),
  input: { prompt: 'User query' },
  output: { response: 'AI response' },
});
```

## Advanced Usage

### Transactions

```typescript
await store.transaction(async (prisma) => {
  // All operations in this block are atomic
  const thread = await prisma.thread.create({
    data: { /* ... */ }
  });

  await prisma.message.createMany({
    data: [/* ... */]
  });

  return thread;
});
```

### Raw Queries

```typescript
// For complex queries not supported by Prisma's query builder
const results = await store.$queryRaw`
  SELECT * FROM mastra_threads
  WHERE metadata->>'source' = 'web'
  ORDER BY "createdAt" DESC
`;
```

### Direct Prisma Client Access

```typescript
// Get the underlying Prisma client for full control
const client = store.getClient();

// Use any Prisma feature directly
const threadsWithMessageCount = await client.thread.findMany({
  include: {
    _count: {
      select: { messages: true }
    }
  }
});
```

## Type Safety

All methods use Prisma's generated types, providing full type safety:

```typescript
import type { Prisma } from '@mastra/prisma';

// Type-safe where clauses
const where: Prisma.ThreadWhereInput = {
  resourceId: 'resource-1',
  createdAt: {
    gte: new Date('2024-01-01'),
  },
};

const threads = await store.getThreadsByResourceId('resource-1', {
  where,
});

// Type-safe updates
const updateData: Prisma.ThreadUpdateInput = {
  title: 'Updated Title',
  metadata: JSON.stringify({ updated: true }),
};

await store.updateThread('thread-123', updateData);
```

## Benefits

1. **No Type Conversions**: Use Prisma types directly without manual mapping
2. **Type Safety**: Full TypeScript support from database to application
3. **Single Source of Truth**: Schema defined once in Prisma
4. **Auto-completion**: IDE knows all available fields and types
5. **Flexibility**: Access to full Prisma client when needed
6. **Performance**: No overhead from type conversions