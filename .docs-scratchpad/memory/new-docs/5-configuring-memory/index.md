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

// This is the default configuration if you don't specify storage/vector
const memory = new Memory({
  storage: new LibSQLStore({
    url: "file:memory.db",
  }),
  vector: new LibSQLVector({
    url: "file:vector.db",
  }),
});
```

You can also use a Turso hosted database by providing a URL instead of a file path:

```typescript
const memory = new Memory({
  storage: new LibSQLStore({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
});
```

### PostgreSQL

PostgreSQL provides robust storage and vector capabilities:

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

## Memory Options

Memory comes with the following default configuration:

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
    template: "## User\n\n...",
    use: "text-stream",
  },
  
  // Thread settings
  threads: {
    generateTitle: true,
  },
};
```

For detailed information on each configuration option, see the dedicated documentation pages:

- [Last Messages](../3-using-memory/3.1-last-messages.md) - Configure recent message history
- [Semantic Recall](../3-using-memory/3.2-semantic-recall.md) - Set up semantic search parameters
- [Working Memory](../3-using-memory/3.3-working-memory.md) - Learn about persistent memory across conversations
- [Token Management](../3-using-memory/3.5-token-management.md) - Optimize token usage and context window 