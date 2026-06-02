# @mastra/mysql

MySQL storage implementation for Mastra, providing persistent storage for threads, messages, workflows, traces, and more with connection pooling and transaction support.

## Installation

```bash
npm install @mastra/mysql
```

## Prerequisites

- MySQL 8.0 or higher

## Usage

```typescript
import { MySQLStore } from '@mastra/mysql';

const store = new MySQLStore({
  connectionString: 'mysql://user:password@localhost:3306/mastra',
});

// Create a thread
await store.saveThread({
  thread: {
    id: 'thread-123',
    resourceId: 'resource-456',
    title: 'My Thread',
    metadata: { key: 'value' },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
});

// Add messages to thread
await store.saveMessages({
  messages: [
    {
      id: 'msg-789',
      threadId: 'thread-123',
      role: 'user',
      content: { content: 'Hello' },
      resourceId: 'resource-456',
      createdAt: new Date(),
    },
  ],
});

// Query threads and messages
const savedThread = await store.getThreadById({ threadId: 'thread-123' });
const messages = await store.listMessages({ threadId: 'thread-123' });
```

### With Mastra

```typescript
import { Mastra } from '@mastra/core';
import { MySQLStore } from '@mastra/mysql';

export const mastra = new Mastra({
  storage: new MySQLStore({
    connectionString: 'mysql://user:password@localhost:3306/mastra',
  }),
});
```

## Configuration

`MySQLStore` supports two connection methods:

**1. Connection String**

```typescript
const store = new MySQLStore({
  connectionString: 'mysql://user:password@localhost:3306/mastra',
});
```

**2. Host/Port/Database**

```typescript
const store = new MySQLStore({
  host: 'localhost',
  port: 3306,
  user: 'mastra',
  password: 'mastra',
  database: 'mastra',
});
```

### Optional Configuration

- `ssl`: Enable SSL or provide custom SSL options (`true` | `false` | object)
- `max`: Maximum pool connections (default: `10`)
- `database`: Override the database name parsed from the connection string
- `waitForConnections`: Queue requests when the pool is full (default: `true`, host config only)
- `queueLimit`: Maximum queued connection requests, `0` for unlimited (default: `0`, host config only)
- `skipDefaultIndexes`: Skip creating the built-in performance indexes during setup (default: `false`)
- `indexes`: Additional custom indexes to create during setup

## Features

- Persistent storage for threads, messages, workflows, scores, datasets, and experiments
- Full observability/tracing storage (spans and traces)
- Atomic transactions for data consistency
- Efficient batch operations
- Connection pooling via `mysql2`
- Automatic table and index setup on first use
- Rich metadata support with JSON columns
- Timestamp tracking and cascading deletes

## Storage Methods

- `saveThread({ thread })`: Create or update a thread
- `getThreadById({ threadId })`: Get a thread by ID
- `deleteThread({ threadId })`: Delete a thread and its messages
- `saveMessages({ messages })`: Save multiple messages in a transaction
- `listMessages({ threadId, perPage?, page? })`: Get messages for a thread with pagination
- `deleteMessages(messageIds)`: Delete specific messages

## Development

### Environment Variables

The test suite reads the following variables to connect to MySQL, falling back to the defaults shown:

- `MYSQL_HOST` (default: `localhost`)
- `MYSQL_PORT` (default: `3306`)
- `MYSQL_USER` (default: `mastra`)
- `MYSQL_PASSWORD` (default: `mastra`)
- `MYSQL_DB` (default: `mastra`)

### Running Tests

Unit tests run without a database:

```bash
pnpm test src/storage/index.unit.test.ts
```

Integration tests use Docker to start a MySQL instance, run the suite, and clean up afterward:

```bash
# Ensure Docker is running
pnpm test
```

## Related Links

- [Mastra Storage Documentation](https://mastra.ai/docs)
- [MySQL Documentation](https://dev.mysql.com/doc/)
