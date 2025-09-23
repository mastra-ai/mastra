# @mastra/drizzle

Drizzle ORM storage adapter for Mastra. Provides a flexible, multi-dialect database storage solution with support for PostgreSQL, MySQL, SQLite, and more.

## Features

- 🗄️ **Multi-dialect support** - PostgreSQL, MySQL, SQLite, Turso, PlanetScale, Neon
- 🔄 **Dynamic dialect loading** - Only loads the driver you need
- 📝 **Type-safe schemas** - Full TypeScript support with Drizzle ORM
- 🏗️ **Schema builder** - Fluent API for cross-dialect schema definitions
- ⚡ **Connection pooling** - Built-in connection management
- 🔍 **Raw SQL support** - Execute custom queries when needed
- 🎯 **Transaction support** - ACID-compliant operations
- 🪝 **Drizzle ecosystem** - Use all Drizzle features and plugins

## Installation

```bash
npm install @mastra/drizzle drizzle-orm

# Install the database driver you need (one or more):
npm install pg                       # PostgreSQL
npm install mysql2                   # MySQL
npm install better-sqlite3           # SQLite
npm install @libsql/client           # Turso
npm install @planetscale/database    # PlanetScale
npm install @neondatabase/serverless # Neon
```

## Quick Start

### SQLite (Simple, no setup required)

```typescript
import { DrizzleStore } from '@mastra/drizzle';

const store = new DrizzleStore({
  dialect: 'sqlite',
  connection: {
    database: './data.db', // or ':memory:' for in-memory
  },
});

await store.init();

// Save a connection
await store.saveConnection({
  id: '1',
  name: 'My API',
  connectionId: 'api-1',
  provider: 'custom',
  config: { apiKey: 'secret' },
});

// Retrieve the connection
const connection = await store.getConnection('api-1');
```

### PostgreSQL

```typescript
const store = new DrizzleStore({
  dialect: 'postgresql',
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'mydb',
    user: 'postgres',
    password: 'password',
  },
  pool: {
    max: 10,
    min: 2,
  },
});
```

### MySQL

```typescript
const store = new DrizzleStore({
  dialect: 'mysql',
  connection: {
    host: 'localhost',
    port: 3306,
    database: 'mydb',
    user: 'root',
    password: 'password',
  },
});
```

### Turso (SQLite at the Edge)

```typescript
const store = new DrizzleStore({
  dialect: 'turso',
  connection: {
    url: 'libsql://your-database.turso.io',
    authToken: 'your-auth-token',
  },
});
```

### PlanetScale (Serverless MySQL)

```typescript
const store = new DrizzleStore({
  dialect: 'planetscale',
  connection: {
    url: process.env.DATABASE_URL,
  },
});
```

### Neon (Serverless PostgreSQL)

```typescript
const store = new DrizzleStore({
  dialect: 'neon',
  connection: {
    connectionString: process.env.DATABASE_URL,
  },
});
```

## Custom Schemas

You can define custom schemas for your storage:

```typescript
import { DrizzleStore, SchemaBuilder } from '@mastra/drizzle';

// Build your schema
const schema = SchemaBuilder.create()
  .table('users')
  .id()
  .text('email', { unique: true, notNull: true })
  .text('name')
  .boolean('active', { default: true })
  .timestamps()
  .index('idx_email', ['email'])
  .build()
  .table('posts')
  .id()
  .text('title', { notNull: true })
  .text('content')
  .uuid('user_id', { notNull: true })
  .timestamps()
  .foreignKey('fk_user', ['user_id'], 'users', ['id'], {
    onDelete: 'cascade',
  })
  .build()
  .build();

// Use the custom schema
const store = new DrizzleStore({
  dialect: 'postgresql',
  connection: {
    /* ... */
  },
  schema, // Your custom schema
});
```

## Advanced Usage

### Direct Database Access

```typescript
// Get the Drizzle database instance
const db = store.getDb();

// Use Drizzle's query builder directly
const users = await db.select().from(schema.users).where(eq(schema.users.active, true));
```

### Raw SQL Queries

```typescript
// Execute raw SQL
const results = await store.query('SELECT * FROM users WHERE email = ?', ['user@example.com']);
```

### Transactions

```typescript
const result = await store.transaction(async tx => {
  // All operations in this block are transactional
  await tx.query('INSERT INTO users (email) VALUES (?)', ['user1@example.com']);
  await tx.query('INSERT INTO users (email) VALUES (?)', ['user2@example.com']);
  return 'Success';
});
```

### Schema Access

```typescript
// Get all table schemas
const schemas = store.getSchemas();

// Access specific table schema
const userTable = schemas.users;
```

## API Reference

### Core Methods

All standard Mastra storage methods are implemented:

- `saveConnection()`, `getConnection()`, `listConnections()`, `updateConnection()`, `deleteConnection()`
- `saveEntity()`, `getEntity()`, `listEntities()`, `updateEntity()`, `deleteEntity()`, `upsertEntity()`
- `saveSync()`, `getSync()`, `listSyncs()`, `updateSync()`, `deleteSync()`

### Additional Methods

- `getDb()` - Get the raw Drizzle database instance
- `getDialect()` - Get the current dialect instance
- `getSchemas()` - Get all table schemas
- `query()` - Execute raw SQL queries
- `transaction()` - Run operations in a transaction

## Development

### Setup

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build the package
npm run build
```

### Testing with Docker

```bash
# Start test databases
docker-compose up -d

# Run all tests
npm test

# Stop databases
docker-compose down
```

## Migration Management

Use Drizzle Kit for migrations:

```bash
# Generate migrations
npx drizzle-kit generate:pg
npx drizzle-kit generate:mysql
npx drizzle-kit generate:sqlite

# Run migrations
npx drizzle-kit push:pg
npx drizzle-kit push:mysql
npx drizzle-kit push:sqlite
```

## License

MIT
