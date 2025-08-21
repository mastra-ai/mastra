# @mastra/mssql

Microsoft SQL Server implementation for Mastra, providing general storage capabilities with connection pooling and transaction support.

## Installation

```bash
npm install @mastra/mssql
```

## Prerequisites

- Microsoft SQL Server 2016 or higher
- User with privileges to create tables and schemas (if needed)

## Usage

### Storage

```typescript
import { MSSQLStore } from '@mastra/mssql';

const store = new MSSQLStore({
  server: 'localhost',
  port: 1433,
  database: 'mastra',
  user: 'sa',
  password: 'yourStrong(!)Password',
  // options: { encrypt: true, trustServerCertificate: true }, // Optional
});

// Create a thread
await store.saveThread({
  id: 'thread-123',
  resourceId: 'resource-456',
  title: 'My Thread',
  metadata: { key: 'value' },
});

// Add messages to thread
await store.saveMessages([
  {
    id: 'msg-789',
    threadId: 'thread-123',
    role: 'user',
    type: 'text',
    content: [{ type: 'text', text: 'Hello' }],
    resourceId: 'resource-456',
    createdAt: new Date(),
  },
]);

// Query threads and messages
const savedThread = await store.getThreadById({ threadId: 'thread-123' });
const messages = await store.getMessages({ threadId: 'thread-123' });
```

## Configuration

The MSSQL store can be initialized with either:

- `connectionString`: Microsoft SQL Server connection string
- Configuration object with server, port, database, user, and password

Connection pool settings are managed by the [mssql](https://www.npmjs.com/package/mssql) package.

## Features

- Thread and message storage with JSON support
- Atomic transactions for data consistency
- Efficient batch operations
- Rich metadata support
- Timestamp tracking
- Cascading deletes (emulated)

## Storage Methods

- `saveThread({ thread })`: Create or update a thread
- `getThreadById({ threadId })`: Get a thread by ID
- `deleteThread({ threadId })`: Delete a thread and its messages
- `saveMessages({ messages })`: Save multiple messages in a transaction
- `getMessages({ threadId })`: Get all messages for a thread
- `updateMessages({ messages })`: Update messages by ID
- `getThreadsByResourceIdPaginated({ resourceId, page, perPage })`: Paginated thread listing
- `getMessagesPaginated({ threadId, selectBy })`: Paginated message listing
- `clearTable({ tableName })`: Remove all rows from a table (with cascade)
- `createTable({ tableName, schema })`: Create a table if it does not exist
- `alterTable({ tableName, schema, ifNotExists })`: Add columns if they do not exist
- `saveResource({ resource })`: Save a resource
- `getResourceById({ resourceId })`: Get a resource by ID
- `updateResource({ resourceId, ... })`: Update a resource

## Related Links

- [Microsoft SQL Server Documentation](https://docs.microsoft.com/en-us/sql/sql-server/)
- [node-mssql Documentation](https://www.npmjs.com/package/mssql)
