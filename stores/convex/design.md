# Convex DB Integration with Mastra Storage Interface

## Architecture Overview

This document outlines the design and implementation of Mastra's storage interface on top of Convex DB, providing a reactive storage backend for AI applications.

### Integration Approach

- **Storage Layer**: Extends `MastraStorage` base class in `ConvexStorage` class
- **Client Communication**: Uses `ConvexHttpClient` for Node.js operations
- **Backend Logic**: Implements Convex query/mutation functions in `convex/` directory
- **Query Support**: Provides both real-time subscriptions and point-in-time queries
- **Design Pattern**: Follows existing Mastra storage patterns (similar to D1, DynamoDB integrations)

### Key Components

1. **ConvexStorage Class**: Main entry point extending MastraStorage
2. **Convex Schema Definitions**: Table structures for Mastra entities
3. **Query/Mutation Functions**: CRUD operations for each entity type
4. **Subscription Capabilities**: Real-time data synchronization
5. **Configuration Management**: Convex deployment URL and API handling

## Technical Implementation

### Storage Class Design

The `ConvexStorage` class implements the Mastra storage interface with Convex-specific implementations:

```typescript
export class ConvexStorage extends MastraStorage {
  private client: ConvexHttpClient;
  private api: any;

  constructor(config: ConvexStorageConfig) {
    super({
      name: 'convex',
    });
    this.client = new ConvexHttpClient(config.convexUrl);
    this.api = config.api;
  }

  // Interface methods implementation...
}
```

The class provides methods for working with:

- **Threads**: Storage, retrieval, and updates of conversation threads
- **Messages**: CRUD operations for messages within threads
- **Traces**: Logging and retrieval of execution traces
- **Evaluations**: Storage and retrieval of agent evaluations
- **Workflow Runs**: Management of workflow execution state

### Database Schema

Convex tables are defined in the schema.ts file with the following structure:

#### Threads Table

- `threadId`: String (primary key, indexed)
- `resourceId`: String (indexed)
- `title`: String
- `metadata`: JSON object
- `createdAt`: Number (timestamp)
- `updatedAt`: Number (timestamp)

#### Messages Table

- `messageId`: String (primary key, indexed)
- `threadId`: String (indexed)
- `messageType`: String
- `content`: JSON object
- `createdAt`: Number (timestamp)

#### Traces Table

- `traceId`: String (primary key, indexed)
- `threadId`: String (indexed)
- `transportId`: String
- `runId`: String
- `rootRunId`: String
- `timestamp`: Number
- `properties`: JSON object
- `spans`: JSON object
- `spanDurations`: JSON object

#### Evals Table

- `evalId`: String (primary key, indexed)
- `threadId`: String (indexed)
- `agentName`: String (indexed)
- `type`: String
- `metadata`: JSON object
- `data`: JSON object
- `createdAt`: Number (timestamp)

#### WorkflowRuns Table

- `runId`: String (primary key, indexed)
- `workflowName`: String (indexed)
- `resourceId`: String (indexed)
- `stateType`: String
- `state`: JSON object
- `error`: JSON object
- `createdAt`: Number (timestamp)
- `updatedAt`: Number (timestamp)
- `completedAt`: Number (timestamp)

### Backend Implementation

#### Query and Mutation Functions

Backend functions are organized by entity type:

- `threads.ts`: Thread-related operations
- `messages.ts`: Message storage and retrieval
- `traces.ts`: Trace logging and queries
- `evals.ts`: Evaluation storage and retrieval
- `workflowRuns.ts`: Workflow execution state management
- `system.ts`: System-level operations (table management)

Each entity module provides standardized query and mutation functions:

```typescript
// Example query pattern
export const getById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('entityName')
      .withIndex('by_id', q => q.eq('id', args.id))
      .first();
  },
});

// Example mutation pattern
export const save = mutation({
  args: { data: v.any() },
  handler: async (ctx, args) => {
    // Logic for inserting or updating records
  },
});
```

#### Querying Approach

Queries are implemented using Convex's query builder:

- Indexed lookups with `withIndex()` for efficient retrieval
- Pagination using `offset()` and `limit()` where supported
- Ordering with `order('asc'|'desc')` for sorted results
- Filtering with `filter()` for additional query conditions

#### Special Considerations

1. **Schema Management**: Unlike SQL databases, Convex schema is defined in code and deployed, not dynamically created at runtime. The `createTable` and `alterTable` methods are implemented as no-ops for API compatibility.

2. **Table Clearing**: Since Convex doesn't support a direct "truncate table" operation, table clearing is implemented by fetching all records and deleting them individually.

3. **Pagination**: Convex provides built-in pagination through offset and limit methods, which are used when available. For complex queries, pagination is managed through application logic.

## Real-time Subscriptions

Convex's real-time capabilities are leveraged through the standard query functions, which can be used with Convex's subscription mechanism:

```typescript
// Client-side subscription example
const unsubscribe = convex.subscribe(api.threads.getByResourceId, { resourceId }).onData(threads => {
  // React to data changes
});
```

The ConvexStorage class is designed to work with this subscription pattern while maintaining compatibility with Mastra's storage interface.

## Configuration Management

Configuration is handled through the `ConvexStorageConfig` interface:

```typescript
export interface ConvexStorageConfig {
  /**
   * Convex deployment URL (e.g., https://xxx.convex.cloud)
   */
  convexUrl: string;

  /**
   * Auto-generated API from Convex
   * Import from convex/_generated/api
   */
  api: any;
}
```

## Error Handling

Error handling follows a consistent pattern across the codebase:

1. Each method wraps its implementation in a try-catch block
2. Errors are converted to descriptive messages with the original error details
3. TypeScript type checking ensures errors are properly typed

Example:

```typescript
try {
  // Implementation logic
} catch (error) {
  throw new Error(`Failed to get thread by ID: ${error instanceof Error ? error.message : String(error)}`);
}
```

## Performance Considerations

1. **Indexed Queries**: All common query patterns use indexed fields for optimal performance
2. **Batch Operations**: Multiple records are handled with batch mutations when possible
3. **Pagination**: Results are paginated to avoid large data transfers
4. **Memory Usage**: Complex in-memory operations are minimized to reduce memory footprint

## Limitations and Future Improvements

1. **Dynamic Schema**: Convex doesn't support dynamic schema modification at runtime, so schema changes require redeployment
2. **Complex Queries**: Some advanced query patterns might require client-side filtering or multiple requests
3. **Migration Support**: The current implementation has limited support for data migrations
4. **Type Safety**: The API interface could be improved with stronger TypeScript typing

## Usage Example

```typescript
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import { ConvexStorage } from './storage';

// Initialize storage
const storage = new ConvexStorage({
  convexUrl: process.env.CONVEX_URL || 'https://example-xxx.convex.cloud',
  api,
});

// Use storage methods
const thread = await storage.getThreadById({ threadId: 'thread_123' });
const messages = await storage.getMessages({ threadId: 'thread_123' });
```
