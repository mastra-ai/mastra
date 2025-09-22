# @mastra/prisma

Prisma ORM storage provider for Mastra, offering type-safe database access with support for multiple database backends.

## Features

- Type-safe database operations with Prisma ORM
- Support for PostgreSQL, MySQL, and SQLite
- Automatic schema migrations
- Connection pooling
- Comprehensive domain implementations for all Mastra features
- AI tracing and observability support

## Installation

```bash
npm install @mastra/prisma
```

## Configuration

### Environment Variables

Create a `.env` file with your database connection:

```env
# PostgreSQL (recommended)
DATABASE_URL="postgresql://user:password@localhost:5432/mastra"

# MySQL
DATABASE_URL="mysql://user:password@localhost:3306/mastra"

# SQLite (for development)
DATABASE_URL="file:./dev.db"
```

### Usage

```typescript
import { PrismaStore } from '@mastra/prisma';
import { Mastra } from '@mastra/core';

// Create the storage instance
const storage = new PrismaStore({
  databaseUrl: process.env.DATABASE_URL,
  logLevel: 'info',
});

// Use with Mastra
const mastra = new Mastra({
  storage,
  // ... other configuration
});
```

## Database Setup

### Run Migrations

First, generate the Prisma client and run migrations:

```bash
# Generate Prisma client
npx prisma generate

# Create and apply migrations
npx prisma migrate dev --name init

# For production
npx prisma migrate deploy
```

### View Database

You can inspect your database using Prisma Studio:

```bash
npx prisma studio
```

## Development

### Testing

```bash
# Start test database
docker compose up -d

# Run tests
npm test

# Clean up
docker compose down -v
```

### Schema Changes

When modifying the Prisma schema:

1. Edit `prisma/schema.prisma`
2. Create a migration: `npx prisma migrate dev --name your_migration_name`
3. Generate types: `npx prisma generate`

## Supported Features

- ✅ Workflow snapshots and state management
- ✅ Thread and message storage (Memory)
- ✅ Trace data storage
- ✅ Score and evaluation storage
- ✅ Resource working memory
- ✅ AI tracing spans
- ✅ Index management
- ✅ Batch operations

## Database Compatibility

| Database   | Status | Notes                          |
| ---------- | ------ | ------------------------------ |
| PostgreSQL | ✅     | Recommended for production     |
| MySQL      | ✅     | Full support                   |
| SQLite     | ✅     | Good for development/testing   |
| MongoDB    | ⚠️     | Requires Prisma MongoDB preview |
| SQL Server | ⚠️     | Requires additional configuration |

## License

Apache-2.0