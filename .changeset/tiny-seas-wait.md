---
'@mastra/memory': patch
---

Fixed `recall` returning message content from outside the configured retrieval scope when called with `partIndex`.

`recall({ mode: "messages", cursor, partIndex })` resolved the cursor message without the ownership checks that the cursor-only path applies. With thread-scoped retrieval (`retrieval: { scope: "thread" }`), an agent that passed a message ID belonging to another resource or another thread received that message part in full. The identical call without `partIndex` was already refused, so `partIndex` was strictly more permissive than browsing.

**What changes**

- `partIndex` now respects the retrieval scope. An out-of-scope cursor fails with `Could not resolve cursor message` instead of returning content.
- In thread scope, the cross-thread refusal no longer names the other thread or suggests passing its ID, because thread-scoped retrieval cannot browse other threads at all. Resource scope keeps that guidance, where browsing another thread of the same resource is supported.

Resource-scoped retrieval can still browse another thread of the same resource and continue reading a truncated part there.

Fixes #21863
