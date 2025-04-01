# Database Options for Memory

This example demonstrates how to configure and use various database backends with Mastra Memory for persistent storage of conversation threads and vector embeddings.

## Overview

We'll cover:
- Setting up LibSQL (default, lightweight option)
- Configuring PostgreSQL (recommended for production)
- Using Upstash Redis (ideal for serverless)
- Connection pooling and optimization
- Migration between storage backends

## LibSQL Example (Default)

LibSQL is the default option and requires minimal setup:

```typescript
// basic-libsql.ts
import { Memory } from "@mastra/memory";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

// Memory with default LibSQL - automatically creates file-based storage
const memory = new Memory();

const agent = new Agent({
  name: "AssistantAgent",
  instructions: "You are a helpful assistant.",
  model: openai("gpt-3.5-turbo"),
  memory,
});

// Usage is the same as any memory-enabled agent
await agent.run("Hello, can you remember this conversation?");
```

### Custom LibSQL Configuration

You can customize the LibSQL configuration:

```typescript
// custom-libsql.ts
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/core/storage/libsql";
import { LibSQLVector } from "@mastra/core/vector/libsql";

const memory = new Memory({
  // Store messages in a specific database file
  storage: new LibSQLStore({
    url: "file:my-memory-storage.db",
  }),
  
  // Store vector embeddings in a separate file
  vector: new LibSQLVector({
    url: "file:my-vector-storage.db",
  }),
});
```

## PostgreSQL Example

For production applications, PostgreSQL provides a robust solution:

```typescript
// postgres-memory.ts
import { Memory } from "@mastra/memory";
import { PostgresStore, PgVector } from "@mastra/pg";
import { openai } from "@ai-sdk/openai";

// First, install the package: npm install @mastra/pg

// Configure memory with PostgreSQL
const memory = new Memory({
  // Storage for messages, threads, and metadata
  storage: new PostgresStore({
    connectionString: process.env.DATABASE_URL!,
    // Connection pool configuration
    pool: {
      max: 20,        // Maximum connections in pool
      min: 5,         // Minimum connections in pool
      idleTimeoutMs: 30000, // Connection timeout when idle
    },
    // Optional table name prefixes
    tablePrefix: "mastra_memory_",
  }),
  
  // Vector database for semantic search embeddings
  vector: new PgVector({
    connectionString: process.env.DATABASE_URL!,
    // Optional: explicitly specify schema for pgvector
    schema: "public",
    // Optional: specify table name
    tableName: "mastra_memory_embeddings",
  }),

  // Use OpenAI embeddings instead of the default FastEmbed
  embedder: openai.embedding("text-embedding-3-small"),
});
```

### Connection Pooling with PostgreSQL

For high-traffic applications, proper connection pooling is important:

```typescript
// optimized-postgres.ts
import { Memory } from "@mastra/memory";
import { PostgresStore, PgVector } from "@mastra/pg";

// Production-ready PostgreSQL configuration
const memory = new Memory({
  storage: new PostgresStore({
    connectionString: process.env.DATABASE_URL!,
    pool: {
      // Optimal settings for serverless environments
      max: 10,         // Maximum 10 concurrent connections
      min: 2,          // Keep 2 connections warm
      idleTimeoutMs: 10000, // Return connections to pool after 10s
      // Recommended for systems like Vercel or AWS Lambda
      strategy: "first", // Use first available connection (faster)
    },
  }),
  
  // Reuse the same connection pool for vector storage
  vector: new PgVector({
    connectionString: process.env.DATABASE_URL!,
    // PgVector will detect and use the same pool as PostgresStore
  }),
});
```

## Upstash Redis Example

Upstash Redis is ideal for serverless/edge environments:

```typescript
// upstash-memory.ts
import { Memory } from "@mastra/memory";
import { UpstashStore, UpstashVector } from "@mastra/upstash";
import { openai } from "@ai-sdk/openai";

// First, install the package: npm install @mastra/upstash

// Configure memory with Upstash Redis
const memory = new Memory({
  // Redis REST API for message storage
  storage: new UpstashStore({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    // Optional prefix for keys
    prefix: "myapp:",
  }),
  
  // Redis for vector storage
  vector: new UpstashVector({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    // Optional index name
    indexName: "mastra_memory_vectors",
  }),
  
  // Cloud embedder required when deploying to edge
  embedder: openai.embedding("text-embedding-3-small"),
});
```

## Environment-Based Configuration

Configure storage backends based on environment:

```typescript
// environment-config.ts
import { Memory } from "@mastra/memory";
import { LibSQLStore, LibSQLVector } from "@mastra/core/storage";
import { PostgresStore, PgVector } from "@mastra/pg";
import { UpstashStore, UpstashVector } from "@mastra/upstash";
import { openai } from "@ai-sdk/openai";

// Choose storage backend based on environment
function getMemoryConfig() {
  // Development: Use LibSQL
  if (process.env.NODE_ENV === "development") {
    return {
      storage: new LibSQLStore({ url: "file:memory-dev.db" }),
      vector: new LibSQLVector({ url: "file:vector-dev.db" }),
    };
  }
  
  // Production: Use PostgreSQL
  if (process.env.DATABASE_URL) {
    return {
      storage: new PostgresStore({ connectionString: process.env.DATABASE_URL }),
      vector: new PgVector({ connectionString: process.env.DATABASE_URL }),
    };
  }
  
  // Vercel or other serverless: Use Upstash
  if (process.env.UPSTASH_REDIS_REST_URL) {
    return {
      storage: new UpstashStore({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      }),
      vector: new UpstashVector({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      }),
    };
  }
  
  // Fallback to default
  return {};
}

// Create memory with environment-specific configuration
const memory = new Memory({
  ...getMemoryConfig(),
  embedder: openai.embedding("text-embedding-3-small"),
  options: {
    lastMessages: 30,
    semanticRecall: {
      topK: 3,
    },
  },
});
```

## Data Migration Example

Moving data between storage backends:

```typescript
// migration.ts
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/core/storage/libsql";
import { PostgresStore } from "@mastra/pg";

async function migrateMemoryData() {
  // Source memory (LibSQL)
  const sourceMemory = new Memory({
    storage: new LibSQLStore({ url: "file:old-data.db" }),
  });
  
  // Target memory (PostgreSQL)
  const targetMemory = new Memory({
    storage: new PostgresStore({ connectionString: process.env.DATABASE_URL! }),
  });
  
  // Get all resources
  const resourceIds = await sourceMemory.storage.getAllResourceIds();
  
  // For each resource, migrate its threads
  for (const resourceId of resourceIds) {
    const threads = await sourceMemory.getThreadsByResourceId({ resourceId });
    
    for (const thread of threads) {
      // Create new thread in target
      const newThread = await targetMemory.createThread({
        resourceId: thread.resourceId,
        title: thread.title,
        metadata: thread.metadata,
      });
      
      // Get messages for this thread
      const { messages } = await sourceMemory.query({
        threadId: thread.id,
        selectBy: { all: true },
      });
      
      // Add messages to new thread (in chronological order)
      for (const message of messages) {
        await targetMemory.storage.addMessage({
          threadId: newThread.id,
          message: {
            role: message.role,
            content: message.content,
            // Include any other message properties
          },
        });
      }
      
      console.log(`Migrated thread ${thread.id} → ${newThread.id}`);
    }
  }
  
  console.log("Migration complete!");
}
```

## Performance Comparison

Here's a comparison of the different storage options:

| Storage Option | Pros | Cons | Best For |
|----------------|------|------|----------|
| **LibSQL** | • Zero config<br>• No external dependencies<br>• Fast local development | • Limited concurrent access<br>• Not suitable for production | • Development<br>• Simple projects<br>• Prototyping |
| **PostgreSQL** | • Production-ready<br>• Fast queries<br>• Native vector support<br>• Good concurrency | • Requires database setup<br>• Connection management | • Production apps<br>• High-traffic use cases<br>• Enterprise deployments |
| **Upstash** | • Serverless-friendly<br>• Edge compatible<br>• No connection limits | • Higher latency<br>• Usage-based pricing | • Serverless deployments<br>• Edge functions<br>• Vercel, Cloudflare |

## Advanced PostgreSQL Configuration

Using custom schemas and optimizing for performance:

```typescript
// advanced-postgres.ts
import { Memory } from "@mastra/memory";
import { PostgresStore, PgVector } from "@mastra/pg";

// Custom schema configuration
const memory = new Memory({
  storage: new PostgresStore({
    connectionString: process.env.DATABASE_URL!,
    // Use a custom schema
    schema: "mastra_memory",
    // Custom table names
    tableNames: {
      threads: "conversation_threads",
      messages: "conversation_messages",
      messageTags: "message_tags",
    },
    // Initialization options
    initOptions: {
      // Create schema if it doesn't exist
      createSchema: true,
      // Don't recreate tables if they exist
      dropTables: false,
    },
  }),
  
  vector: new PgVector({
    connectionString: process.env.DATABASE_URL!,
    schema: "mastra_memory",
    tableName: "embeddings",
    // Set vector dimension to match your embedding model
    dimensions: 1536, // For OpenAI embeddings
  }),
});
```

## Troubleshooting and Best Practices

1. **Database Permissions** - Ensure your database user has the necessary permissions:
   ```sql
   -- PostgreSQL permissions example
   GRANT CREATE ON SCHEMA public TO your_user;
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
   ```

2. **Environment Variables** - Store connection strings securely as environment variables:
   ```shell
   # .env file
   DATABASE_URL=postgresql://user:password@localhost:5432/mydb
   UPSTASH_REDIS_REST_URL=https://your-endpoint.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-token
   ```

3. **Connection Pooling** - Adjust pool settings based on your deployment:
   - Serverless: Lower max connections (5-10), shorter idle timeouts
   - Server: Higher max connections (20+), longer idle timeouts

4. **Vector Dimensions** - Match vector dimensions to your embedder:
   - OpenAI text-embedding-3-small: 1536 dimensions
   - FastEmbed (default): 384 dimensions

5. **Backup Strategy** - Regularly back up your database:
   ```bash
   # PostgreSQL backup example
   pg_dump -U user -d mastra_db -f mastra_backup.sql
   ```

## Related Documentation

- [Database Adapters](../5-configuring-memory/5.1-database-adapters.md)
- [Recommended Settings](../5-configuring-memory/5.2-defaults-and-settings.md)
- [Deployment Options](../5-configuring-memory/5.3-deployment-options.md) 