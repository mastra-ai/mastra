---
'@mastra/client-js': minor
'@mastra/memory': minor
'@mastra/server': minor
'@mastra/mongodb': minor
'@mastra/core': minor
'@mastra/libsql': minor
'@mastra/pg': minor
---

Added Observational Memory — a new memory system that keeps your agent's context window small while preserving long-term memory across conversations.

**Why:** Long conversations cause context rot and waste tokens. Observational Memory compresses conversation history into observations (5–40x compression) and periodically condenses those into reflections. Your agent stays fast and focused, even after thousands of messages.

**Usage:**

```ts
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';

const memory = new Memory({
  storage: new PostgresStore({ connectionString: process.env.DATABASE_URL }),
  options: {
    observationalMemory: true,
  },
});

const agent = new Agent({
  name: 'my-agent',
  model: openai('gpt-4o'),
  memory,
});
```

**What's new:**

- `observationalMemory: true` enables the three-tier memory system (recent messages → observations → reflections)
- Thread-scoped (per-conversation) and resource-scoped (shared across all threads for a user) modes
- Manual `observe()` API for triggering observation outside the normal agent loop
- New OM storage methods for pg, libsql, and mongodb adapters (conditionally enabled)
- `Agent.findProcessor()` method for looking up processors by ID
- `processorStates` for persisting processor state across loop iterations
- Abort signal propagation to processors
- `ProcessorStreamWriter` for custom stream events from processors
