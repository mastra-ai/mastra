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
      url: process.env.MASTRA_DB_URL!, // set MASTRA_DB_URL to an absolute path; a relative URL resolves against the working directory
    }),
  }), // Add memory here
})
```

By adding the `memory` property to your agent configuration, you're enabling it to remember previous conversations. The `Memory` class from the `@mastra/memory` package provides a simple way to add memory capabilities to your agent. The `LibSQLStore` class from `@mastra/libsql` persists the memory data to a `SQLite` database.

A relative `file:` URL is resolved against the process working directory, not your project root. `mastra dev` runs your app with its working directory set to `src/mastra/public`, so a relative URL such as `'file:./memory.db'` creates the database inside that folder, which the dev server serves as public assets. Set `MASTRA_DB_URL` to an absolute path instead, and add it to `.env`:

```bash
MASTRA_DB_URL="file:/Users/you/projects/my-app/mastra.db"
```
