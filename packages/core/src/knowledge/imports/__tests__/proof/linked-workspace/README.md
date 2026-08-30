# Calendar importer linked-workspace proof

This consumer links the current workspace builds of `@mastra/core`, `@mastra/libsql`, and `@mastra/pg`. It runs a deterministic calendar importer through public package exports and writes a concise `result.json`.

Materialize it with `create-linked-workspace.ts`, install with `pnpm install --offline`, then run:

```bash
KNOWLEDGE_ADAPTER=libsql pnpm calendar -- --scenario all --out ../libsql
KNOWLEDGE_ADAPTER=pg pnpm calendar -- --scenario all --out ../pg
```

The scenario proves crash-before-cursor replay, UUID stability, update reconciliation, omission safety, explicit owned removal, cron overlap skipping, webhook FIFO behavior, distinct-binding concurrency, and run-linked activity.
