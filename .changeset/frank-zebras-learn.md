---
'@mastra/core': minor
'@mastra/libsql': minor
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
---

Adds the `tool_provider_connections` storage domain. Stored agents can now persist per-agent ToolProvider config, and agent runs can resolve OAuth-style connections (per-author, shared, or caller-supplied) without re-prompting the user every run.

**What you can do**

- Pin a connection on a stored agent's config and have it round-trip on read/write/create.
- Persist multiple connections per toolkit and let the runtime fan-out to the right one at execution time (runtime ships in a follow-up PR).

**Example**

```ts
import { LibSQLStore } from '@mastra/libsql';

const storage = new LibSQLStore({ url: process.env.DATABASE_URL });

// Persist an OAuth connection that an agent can pin later
await storage.toolProviders.upsertConnection({
  authorId: 'user-123',
  providerId: 'composio',
  connectionId: 'auth_abc',
  toolkit: 'gmail',
  label: 'Work inbox',
  scope: 'per-author',
});

// List a user's own connections (admin can omit authorId to list across users)
const { items } = await storage.toolProviders.listConnectionsByAuthor({
  authorId: 'user-123',
  providerId: 'composio',
});
```

Additive — existing stored agents continue to work unchanged. The runtime that consumes this domain ships in a follow-up PR.

PR 1 of 3 split from #17224.
