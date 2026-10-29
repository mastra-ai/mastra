# Adding Memory to Your Agent

Now, let's update our agent to include memory. Open your `agents/index.ts` file and make the following changes:

1. Import the Memory and LibSQLStore classes:

```typescript
import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { LibSQLStore } from '@mastra/libsql'
import { getTransactionsTool } from '../tools'
```

2. Add memory to your agent configured by a storage instance:

```typescript
export const financialAgent = new Agent({
  name: 'Financial Assistant Agent',
  instructions: `ROLE DEFINITION
  // ... existing instructions ...
  `,
  model: 'openai/gpt-5.4',
  tools: { getTransactionsTool },
  memory: new Memory({
    storage: new LibSQLStore({
      id: 'learning-memory-storage',
      url: process.env.MASTRA_DB_URL ?? 'file:./memory.db', // set MASTRA_DB_URL to an absolute path; a relative URL resolves against the working directory
    }),
  }), // Add memory here
})
```

By adding the `memory` property to your agent configuration, you're enabling it to remember previous conversations. The `Memory` class from the `@mastra/memory` package provides a simple way to add memory capabilities to your agent. The `LibSQLStore` class from `@mastra/libsql` persists the memory data to a `SQLite` database.

Relative `file:` URLs are resolved against the process working directory, not your project root. `mastra dev` runs your app with its working directory set to `src/mastra/public`, so `'file:./memory.db'` creates the database inside that folder. Set `MASTRA_DB_URL` to an absolute path (for example `file:/Users/you/projects/my-app/mastra.db`) when you want the database at a fixed location.
