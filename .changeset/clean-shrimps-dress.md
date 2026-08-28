---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/libsql': minor
'@mastra/mysql': minor
'@mastra/spanner': minor
---

Fixed duplicate replies and broken interactive elements when running more than one Mastra instance behind a load balancer.

Channel state (message deduplication keys, Slack modal state) lived in a per-process cache, so each instance kept its own copy. Slack retries deliveries, and with two instances every retry looked new to at least one of them, so users got the same answer twice. A modal opened by one instance could not be submitted through another.

Channel state now lives in your configured storage, shared by every instance. Sharing needs a backend that supports it: PostgreSQL, libSQL, MySQL, Google Cloud Spanner, or Convex. On PostgreSQL, libSQL, MySQL, and Spanner, no code changes are needed and the table is created automatically on startup with no migration to run:

```ts
export const mastra = new Mastra({
  storage: new PostgresStore({ connectionString: process.env.DATABASE_URL }),
  agents: { supportAgent },
});
```

Convex needs one schema addition, described in the `@mastra/convex` changelog entry.

If your storage package is older than the core release, or your backend does not support shared channel state, channel state stays per-process. That is only safe for a single instance, unless you provide a shared `state` adapter in the channel config.

Fixes #18877
