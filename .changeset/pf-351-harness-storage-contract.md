---
'@mastra/core': minor
'@mastra/libsql': minor
---

[PF-351] Add namespace-aware Harness v1 admission/result storage contracts.

Added:

- Namespace scoping for Harness session and attachment storage.
- Atomic active-session create/load behavior for `(harnessName, resourceId, threadId)`.
- Durable queue admission receipts, lifecycle timestamps, retained result/tombstone lookups, duplicate/conflict resolution, compaction, and session-scoped tombstone cleanup.

```ts
const result = await harnessStorage.createOrLoadActiveSession(
  { ...record, harnessName: 'alpha' },
  { initialLease: { ownerId: 'worker-1', ttlMs: 30000 } },
);
```

Tests and projects can now use namespace-scoped Harness storage without key collisions, with in-memory and LibSQL backends covered by the same conformance behavior.
