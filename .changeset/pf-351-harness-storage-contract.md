---
'@mastra/core': minor
'@mastra/libsql': minor
---

Added namespace-aware Harness v1 storage contracts for admission and result evidence.

Harness storage is now namespace-aware, so multiple Harness instances can isolate sessions and attachments without key collisions. Active sessions are created and loaded atomically for each `(harnessName, resourceId, threadId)`, and duplicate admissions can replay retained result evidence instead of starting conflicting work.

Storage adapters also get durable cleanup hooks for completed results and session-scoped admission records, so in-memory and LibSQL backends share the same retry and cleanup behavior.

```ts
const result = await harnessStorage.createOrLoadActiveSession(
  { ...record, harnessName: 'alpha' },
  { initialLease: { ownerId: 'worker-1', ttlMs: 30000 } },
);
```

Projects can now use namespace-scoped Harness storage without key collisions, with in-memory and LibSQL backends covered by the same conformance behavior.
