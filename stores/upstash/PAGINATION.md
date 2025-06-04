# Upstash Store Pagination Features

This document describes the pagination capabilities added to the UpstashStore class for efficient data retrieval from Upstash Redis.

## Overview

The UpstashStore now supports comprehensive pagination across all major data retrieval methods. Pagination helps manage large datasets by:

- Reducing memory usage by loading data in chunks
- Improving response times for large collections
- Supporting both cursor-based and offset-based pagination patterns
- Providing total count information for UI pagination controls

## Pagination Patterns

The implementation supports two pagination patterns to match different use cases:

### 1. Page-based Pagination (page/perPage)

```typescript
const result = await store.getEvals({
  agentName: 'my-agent',
  page: 0, // First page (0-based)
  perPage: 20, // 20 items per page
});
```

### 2. Offset-based Pagination (limit/offset)

```typescript
const result = await store.getEvals({
  agentName: 'my-agent',
  limit: 20, // Maximum items to return
  offset: 40, // Skip first 40 items
});
```

## Enhanced Methods

### 1. getEvals() - New Comprehensive Evaluation Retrieval

```typescript
const result = await store.getEvals({
  agentName?: string;           // Filter by agent name
  type?: 'test' | 'live';       // Filter by evaluation type
  page?: number;                // Page number (0-based)
  perPage?: number;             // Items per page
  limit?: number;               // Alternative: max items
  offset?: number;              // Alternative: items to skip
  fromDate?: Date;              // Filter by date range
  toDate?: Date;
});

// Returns:
{
  evals: EvalRow[];             // Evaluation results
  total: number;                // Total count (before pagination)
  page?: number;                // Current page (page-based)
  perPage?: number;             // Items per page (page-based)
  hasMore: boolean;             // Whether more data exists
}
```

### 2. getMessages() - Enhanced with Pagination Support

The existing `getMessages` function now supports pagination while maintaining full backward compatibility:

```typescript
// Original usage (backward compatible) - returns message array
const messages = await store.getMessages({
  threadId: 'thread-id',
  format: 'v2'
});

// New paginated usage - returns pagination object
const result = await store.getMessages({
  threadId: 'thread-id',
  page: 0,                      // Page number (0-based)
  perPage: 20,                  // Items per page (default: 40)
  format: 'v2',                 // Message format
  fromDate?: Date,              // Filter by creation date
  toDate?: Date,                // Filter by creation date
});

// Paginated result format:
{
  messages: MastraMessageV1[] | MastraMessageV2[];
  total: number;                // Total count
  page: number;                 // Current page
  perPage: number;              // Items per page
  hasMore: boolean;             // Whether more data exists
}
```

**Key Features:**

- **Backward Compatible**: Existing code continues to work unchanged
- **Conditional Return Type**: Returns array when no pagination params, object when paginated
- **Date Filtering**: Combine pagination with date range filtering
- **Maintains Message Order**: Preserves chronological order from Redis sorted sets
- **Efficient Pipelines**: Uses Redis pipelines for batch operations

### 3. getThreads() - New Comprehensive Thread Retrieval

```typescript
const result = await store.getThreads({
  resourceId?: string;          // Filter by resource ID
  page?: number;                // Page number (0-based)
  perPage?: number;             // Items per page
  limit?: number;               // Alternative: max items
  offset?: number;              // Alternative: items to skip
  fromDate?: Date;              // Filter by creation date
  toDate?: Date;
});

// Returns:
{
  threads: StorageThreadType[]; // Thread results
  total: number;                // Total count
  page?: number;
  perPage?: number;
  hasMore: boolean;
}
```

### 4. getTracesWithCount() - Enhanced Trace Retrieval

```typescript
const result = await store.getTracesWithCount({
  name?: string;                // Filter by trace name
  scope?: string;               // Filter by scope
  page?: number;                // Page number (0-based)
  perPage?: number;             // Items per page (default: 100)
  attributes?: Record<string, string>; // Filter by attributes
  filters?: Record<string, any>; // Custom filters
  fromDate?: Date;              // Date range filtering
  toDate?: Date;
});

// Returns:
{
  traces: any[];                // Trace results
  total: number;                // Total count
  page: number;
  perPage: number;
  hasMore: boolean;
}
```

## Enhanced Existing Methods

### 1. getEvalsByAgentName() - Now with Pagination

```typescript
const evals = await store.getEvalsByAgentName(
  'agent-name',
  'test' | 'live',
  {
    page?: number;
    perPage?: number;
    limit?: number;
    offset?: number;
  }
);
```

### 2. getThreadsByResourceId() - Now with Pagination

```typescript
const threads = await store.getThreadsByResourceId({
  resourceId: 'resource-id',
  page?: number;
  perPage?: number;
  limit?: number;
  offset?: number;
});
```

### 3. getWorkflowRuns() - Improved Performance

The existing method now uses Redis pipelines for better performance:

```typescript
const result = await store.getWorkflowRuns({
  namespace?: string;           // Default: 'workflows'
  workflowName?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
  resourceId?: string;
});
```

## Utility Methods

### 1. scanWithCursor() - Cursor-based Key Scanning

```typescript
const result = await store.scanWithCursor(
  'pattern:*',     // Redis key pattern
  '0',             // Cursor (use '0' for first scan)
  1000             // Count hint
);

// Returns:
{
  keys: string[];       // Found keys
  nextCursor: string;   // Cursor for next iteration
  hasMore: boolean;     // Whether more keys exist
}
```

### 2. getPaginatedResults() - Generic Pagination Utility

```typescript
const result = await store.getPaginatedResults<TransformedType>(
  'pattern:*',          // Redis key pattern
  0,                    // Page number
  20,                   // Items per page
  (record) => ({        // Optional transformer function
    // Transform raw record to desired format
    id: record.id,
    name: record.name
  })
);

// Returns:
{
  data: TransformedType[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}
```

## Performance Optimizations

### Redis Pipeline Usage

All pagination methods use Redis pipelines to batch multiple GET operations, significantly improving performance when retrieving multiple records.

```typescript
// Instead of multiple individual calls:
// const result1 = await redis.get(key1);
// const result2 = await redis.get(key2);

// We use pipelines:
const pipeline = redis.pipeline();
keys.forEach(key => pipeline.get(key));
const results = await pipeline.exec();
```

### Efficient Scanning

The implementation uses Redis SCAN operations with cursor-based iteration to efficiently handle large key spaces without blocking the Redis server.

### Memory Management

- Results are filtered and transformed only after pagination is applied
- Large datasets are processed in chunks to prevent memory issues
- Unnecessary data transformations are avoided for better performance

## Example Usage

### Basic Message Pagination

```typescript
// Get first page of messages with pagination metadata
const page1 = await store.getMessages({
  threadId: 'thread-123',
  page: 0,
  perPage: 20,
  format: 'v2',
});

console.log(`Showing ${page1.messages.length} of ${page1.total} messages`);
console.log(`Has more: ${page1.hasMore}`);

// Backward compatible usage (no pagination metadata)
const allMessages = await store.getMessages({
  threadId: 'thread-123',
  format: 'v2',
});
console.log(`Retrieved ${allMessages.length} messages`);
```

### Basic Evaluation Pagination

```typescript
// Get first page of evaluations for an agent
const page1 = await store.getEvals({
  agentName: 'my-agent',
  page: 0,
  perPage: 20,
});

console.log(`Showing ${page1.evals.length} of ${page1.total} evaluations`);
console.log(`Has more: ${page1.hasMore}`);
```

### Date Range with Pagination

```typescript
// Get recent threads with pagination
const recentThreads = await store.getThreads({
  fromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
  page: 0,
  perPage: 10,
});
```

### Filtered Traces with Pagination

```typescript
// Get production traces with specific attributes
const prodTraces = await store.getTracesWithCount({
  scope: 'production',
  attributes: { environment: 'prod', service: 'api' },
  page: 1,
  perPage: 50,
});
```

### Message Date Filtering

```typescript
// Get recent messages from a thread
const recentMessages = await store.getMessages({
  threadId: 'thread-123',
  page: 0,
  perPage: 10,
  fromDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
  format: 'v2',
});
```

## Best Practices

1. **Use appropriate page sizes**: Start with 20-100 items per page depending on data size
2. **Implement client-side caching**: Cache paginated results to reduce server load
3. **Handle empty results**: Always check if the returned array is empty
4. **Use date filters**: Combine pagination with date filters for better performance
5. **Monitor total counts**: Use the `total` field to implement proper pagination UI
6. **Choose the right pattern**: Use page/perPage for UI pagination, limit/offset for data processing
7. **Leverage backward compatibility**: Existing `getMessages` calls work unchanged
8. **Check return types**: Use TypeScript overloads to get proper type inference

## Migration Guide

The enhanced `getMessages` function is fully backward compatible. No changes are required for existing code, but you can opt into pagination features:

### For Messages

```typescript
// Existing code (continues to work unchanged)
const messages = await store.getMessages({
  threadId: 'thread-123',
  format: 'v2',
});

// Enhanced with pagination (new functionality)
const result = await store.getMessages({
  threadId: 'thread-123',
  page: 0,
  perPage: 20,
  format: 'v2',
});
const messages = result.messages;
const total = result.total;
```

### For Other Methods

If you're using existing methods, they remain backward compatible. To take advantage of new pagination features:

1. **Replace** `getEvalsByAgentName()` calls with `getEvals()` for better filtering and pagination
2. **Replace** `getThreadsByResourceId()` calls with `getThreads()` for date filtering and total counts
3. **Use** `getMessages()` with pagination parameters instead of complex `selectBy` logic when appropriate
4. **Use** `getTracesWithCount()` instead of `getTraces()` when you need total counts

Example migration:

```typescript
// Before:
const evals = await store.getEvalsByAgentName('agent-name');

// After:
const result = await store.getEvals({
  agentName: 'agent-name',
  page: 0,
  perPage: 20,
});
const evals = result.evals;
const total = result.total;
```
