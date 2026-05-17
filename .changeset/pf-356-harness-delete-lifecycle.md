---
"@mastra/core": minor
"@mastra/libsql": patch
"@mastra/clickhouse": patch
"@mastra/cloudflare": patch
---

Added guarded session deletion for Harness sessions.

Deleting a thread now removes the owning session subtree after safely closing active work.
Harness storage adapters now expose thread-scoped active session lookups and thread delete fences so global memory thread deletion is guarded across resources, concurrent admission, and adapter-visible Harness namespaces.
Adapters that do not implement the new delete-safety hooks, memory-only harnesses without Harness session storage, and harnesses configured as a separate session-storage override now fail closed for their own `threads.delete(...)` calls instead of falling back to unsafe global memory deletion.
When a separate session storage attaches to an existing memory thread, the thread is durably marked with reserved Harness metadata as externally owned so later deletion attempts in other processes fail closed instead of deleting global thread/message rows they cannot prove are unowned.
Message admission result evidence follow-up writes are now best-effort after dispatch, and same-hash races resolve as duplicate admissions instead of converting live runs into caller-visible conflicts.
The ClickHouse table-engine map now includes Harness storage tables so package builds stay exhaustive as Harness storage schemas evolve, and Cloudflare Workers binding types remain compatible with partial table bindings.

```ts
await harness.threads.delete({
  resourceId: 'project-xyz',
  threadId: thread.id,
});
```
