# Configuring Memory

Mastra's memory system is highly configurable, allowing you to adapt it to your specific requirements. This section covers how to configure storage backends, vector databases, and memory settings.

## Database Adapters

Mastra memory supports multiple storage backends for persistence:

### LibSQL (Default)

LibSQL is included by default and provides a lightweight, file-based storage solution:

```typescript
import { LibSQLStore } from "@mastra/core/storage/libsql";
import { LibSQLVector } from "@mastra/core/vector/libsql";
import { Memory } from "@mastra/memory";

const memory = new Memory({
  storage: new LibSQLStore({
    url: "file:memory.db",
  }),
  vector: new LibSQLVector({
    url: "file:vector.db",
  }),
});
```

### PostgreSQL

For production applications, PostgreSQL provides robust storage and vector capabilities:

```typescript
import { PostgresStore, PgVector } from "@mastra/pg";
import { Memory } from "@mastra/memory";

const memory = new Memory({
  storage: new PostgresStore({
    connectionString: "postgresql://user:password@localhost:5432/db",
  }),
  vector: new PgVector("postgresql://user:password@localhost:5432/db"),
});
```

### Upstash Redis

For serverless and edge deployments, Upstash Redis provides a managed solution:

```typescript
import { UpstashStore } from "@mastra/upstash";
import { Memory } from "@mastra/memory";

const memory = new Memory({
  storage: new UpstashStore({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
});
```

## Embedding Models

You can configure which embedding model is used for semantic search:

```typescript
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";

const memory = new Memory({
  // Custom embedder (FastEmbed is used by default)
  embedder: openai.embedding("text-embedding-3-small"),
});
```

## Default Settings

Memory is pre-configured with sensible defaults:

```typescript
const defaultSettings = {
  // Recent message retrieval
  lastMessages: 40,
  
  // Semantic search
  semanticRecall: {
    topK: 2,
    messageRange: 2,
  },
  
  // Working memory
  workingMemory: {
    enabled: false,
    template: "<user>...</user>",
    use: "text-stream",
  },
  
  // Thread settings
  threads: {
    generateTitle: true,
  },
};
```

## Complete Configuration Example

Here's a comprehensive configuration example:

```typescript
import { Memory } from "@mastra/memory";
import { PgVector, PostgresStore } from "@mastra/pg";
import { openai } from "@ai-sdk/openai";

const memory = new Memory({
  // Storage backend
  storage: new PostgresStore({
    connectionString: process.env.DATABASE_URL!,
  }),
  
  // Vector database
  vector: new PgVector(process.env.DATABASE_URL!),
  
  // Embedding model
  embedder: openai.embedding("text-embedding-3-small"),
  
  // Memory options
  options: {
    // Recent message settings
    lastMessages: 20,
    
    // Semantic search settings
    semanticRecall: {
      topK: 5,
      messageRange: {
        before: 1,
        after: 2,
      },
    },
    
    // Working memory settings
    workingMemory: {
      enabled: true,
      use: "tool-call",
      template: "<user><preferences></preferences></user>",
    },
    
    // Thread settings
    threads: {
      generateTitle: true,
    },
  },
});
```

Refer to the specific adapter documentation for additional configuration options and advanced settings. 