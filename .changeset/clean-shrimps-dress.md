---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/libsql': minor
'@mastra/mysql': minor
'@mastra/spanner': minor
---

Fixed duplicate replies and broken interactive elements when running more than one Mastra instance behind a load balancer.

Channel state (message deduplication keys, Slack modal state) lived in a per-process cache, so each instance kept its own copy. Slack retries deliveries, and with two instances every retry looked new to at least one of them, so users got the same answer twice. A modal opened by one instance could not be submitted through another.

Channel state now lives in your configured storage, shared by every instance. No code changes are needed, and the table is created automatically on startup with no migration to run:

```ts
export const mastra = new Mastra({
  storage: new PostgresStore({ connectionString: process.env.DATABASE_URL }),
  agents: { supportAgent },
});
```

If your storage package is older than the core release, channel state stays per-process until you upgrade it. That is only safe for a single instance.

Fixes #18877
