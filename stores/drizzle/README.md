# @mastra/drizzle

Drizzle ORM storage adapter for Mastra. Provides a unified interface for multiple databases using Drizzle ORM.

## Features

- 🚀 Support for PostgreSQL, MySQL, SQLite, and more
- 🔄 Automatic dialect detection
- 📦 Type-safe queries with full TypeScript support
- 🛠️ Built-in migration tools
- ⚡ Optimized performance with connection pooling
- 🔌 Direct access to Drizzle client for advanced queries

## Installation

```bash
npm install @mastra/drizzle drizzle-orm

# Install the driver for your database
npm install pg           # for PostgreSQL
npm install mysql2        # for MySQL
npm install @libsql/client # for SQLite/Turso
```

## Usage

```typescript
import { Mastra } from '@mastra/core';
import { DrizzleStore } from '@mastra/drizzle';

const mastra = new Mastra({
  storage: new DrizzleStore({
    dialect: 'postgresql',
    connection: process.env.DATABASE_URL,
  }),
});

// Use standard Mastra APIs
const thread = await mastra.memory.createThread({
  id: 'thread-1',
  metadata: { user: 'john' },
});

// Or access Drizzle directly for advanced queries
const store = mastra.storage as DrizzleStore;
const db = store.getDb();
const schemas = store.getSchemas();
```

## Supported Databases

- PostgreSQL
- MySQL
- SQLite
- Turso
- PlanetScale
- Neon
- Vercel Postgres
- TiDB
- Cloudflare D1

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build
```

## License

Apache-2.0
