# Storage Configuration

Conversation history relies on a storage adapter to persist messages. By default, Mastra uses a LibSQL store that saves messages to a local database. You can configure this or use other storage options:

```typescript
import { Memory } from '@mastra/memory'
import { LibSQLStore } from '@mastra/libsql'

const memory = new Memory({
  // Configure storage
  storage: new LibSQLStore({
    id: 'learning-memory-storage',
    url: process.env.MASTRA_DB_URL!, // set MASTRA_DB_URL to an absolute path; a relative URL resolves against the working directory
  }),
  options: {
    lastMessages: 20,
  },
})
```

Mastra supports several storage options, including:

- LibSQL (default, local SQLite)
- PostgreSQL
- Upstash (Redis)

## Where the local database file lives

A relative `file:` URL is resolved against the process working directory, not your project root. Under `mastra dev`, that working directory is `src/mastra/public`, so `'file:./memory.db'` writes the database into that folder. Set `MASTRA_DB_URL` to an absolute path, such as `file:/Users/you/projects/my-app/mastra.db`, and add it to `.env`:

```bash
MASTRA_DB_URL="file:/Users/you/projects/my-app/mastra.db"
```

An absolute path keeps the file at a predictable location that stays out of the public assets folder, and lets several processes share the same database.

The storage adapter is responsible for persisting memory data, including conversation history and working memory. This allows your agent to remember conversations even after your application restarts.

For development and testing, the default LibSQL store is usually sufficient. For production applications, you might want to use a more robust storage option like PostgreSQL or a cloud-based solution like Upstash.
